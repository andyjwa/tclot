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
import './LiveFixtureCard.css';

const TH_AXIS = 8;
const TH_PAGE = 70;
const TH_CLOSE = 110;
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
 * Mobile swipeable deck of live fixture cards — the production counterpart
 * of the Apple-Sports-style mockup. Portals to `document.body`, slides up
 * as a sheet, pages horizontally between fixtures, and dismisses on a
 * swipe-down / scrim tap / Esc / back button. Sits below the player detail
 * overlay (z-index 10050) so tapping a player still slides in over the top.
 *
 * @param {{ fixtures: object[], openIndex: number|null, onClose: () => void, ctx: object }} props
 */
export function LiveFixtureCardDeck({ fixtures, openIndex, onClose, ctx }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [index, setIndex] = useState(0);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark');

  const sheetRef = useRef(null);
  const deckRef = useRef(null);
  const scrimRef = useRef(null);
  const indexRef = useRef(0);

  const N = fixtures.length;

  // Open: mount, jump to the tapped fixture, then animate the sheet up.
  // State updates happen inside rAF callbacks (not synchronously in the
  // effect body) so the first paint stays at translateY(100%) and the
  // is-open class is applied on the next frame to trigger the transition.
  useEffect(() => {
    if (openIndex == null) return undefined;
    const target = Math.max(0, Math.min(openIndex, N - 1));
    const r1 = requestAnimationFrame(() => {
      setMounted(true);
      setIndex(target);
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

  // Esc to close.
  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, requestClose]);

  // Keep the deck transform in sync with the resting index (dot clicks,
  // programmatic open, post-swipe settle).
  useLayoutEffect(() => {
    indexRef.current = index;
    if (deckRef.current) {
      deckRef.current.style.transform = `translateX(${-index * 100}%)`;
    }
  }, [index, mounted]);

  // Gesture handling: horizontal paging + swipe-down dismiss. Native
  // (non-passive) listeners so we can preventDefault during drags.
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
    let active = false;

    const point = (e) => (e.touches ? e.touches[0] : e);

    const onDown = (e) => {
      active = true;
      axis = null;
      dx = 0;
      dy = 0;
      const p = point(e);
      startX = p.clientX;
      startY = p.clientY;
    };
    const onMove = (e) => {
      if (!active) return;
      const p = e.touches ? e.touches[0] : e;
      dx = p.clientX - startX;
      dy = p.clientY - startY;
      if (!axis && (Math.abs(dx) > TH_AXIS || Math.abs(dy) > TH_AXIS)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      const idx = indexRef.current;
      if (axis === 'x') {
        if (e.cancelable) e.preventDefault();
        deck.classList.add('is-dragging');
        let d = dx;
        if ((idx === 0 && dx > 0) || (idx === N - 1 && dx < 0)) d = dx * 0.3;
        deck.style.transform = `translateX(calc(${-idx * 100}% + ${d}px))`;
      } else if (axis === 'y') {
        const scrollEl = deck.querySelectorAll('.lfc-card__scroll')[idx];
        if (dy > 0 && (!scrollEl || scrollEl.scrollTop <= 0)) {
          if (e.cancelable) e.preventDefault();
          sheet.classList.add('is-dragging');
          sheet.style.transform = `translateY(${dy}px)`;
          if (scrim) scrim.style.opacity = String(Math.max(0, 1 - dy / 500));
        }
      }
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      const idx = indexRef.current;
      if (axis === 'x') {
        deck.classList.remove('is-dragging');
        let next = idx;
        if (dx < -TH_PAGE && idx < N - 1) next = idx + 1;
        else if (dx > TH_PAGE && idx > 0) next = idx - 1;
        deck.style.transform = `translateX(${-next * 100}%)`;
        if (next !== idx) setIndex(next);
      } else if (axis === 'y') {
        sheet.classList.remove('is-dragging');
        if (scrim) scrim.style.opacity = '';
        if (dy > TH_CLOSE) {
          // Finish the swipe-down off-screen. The inline transform set during
          // the drag overrides the class-based rules, so we must animate it to
          // translateY(100%) here — otherwise removing `is-open` on close can't
          // move the sheet and it stays frozen at the release position.
          sheet.style.transform = 'translateY(100%)';
          requestClose();
        } else {
          // Spring back: clear the inline transform so the `is-open` class
          // rule (translateY(0)) drives the snap-back and no inline override
          // lingers to block a later close animation.
          sheet.style.transform = '';
        }
      }
      axis = null;
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
  }, [mounted, N, requestClose]);

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
        <div className="lfc-grip" aria-hidden="true">
          <i />
        </div>
        <button
          type="button"
          className="lfc-close"
          onClick={requestClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="lfc-viewport">
          <div ref={deckRef} className="lfc-deck">
            {fixtures.map((fx) => (
              <div className="lfc-page" key={fx.key}>
                <LiveFixtureCard fixture={fx} ctx={ctx} />
              </div>
            ))}
          </div>
        </div>
        {N > 1 ? (
          <div className="lfc-dots" role="tablist" aria-label="Fixtures">
            {fixtures.map((fx, i) => (
              <button
                key={fx.key}
                type="button"
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
