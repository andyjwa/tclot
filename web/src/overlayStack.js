import { useEffect, useRef } from 'react';

/**
 * Tiny LIFO registry of open full-screen overlays (live fixture deck, player
 * detail, team detail). Each overlay owns its Escape / history-back listeners
 * independently, so without coordination one Escape press (or one system
 * back) used to act on every open layer at once. Registering here lets each
 * handler ask "am I the top layer?" and act only when it is, peeling one
 * overlay at a time.
 */
const stack = [];

/** Register an open overlay. Call `release()` on unmount/close. */
export function registerOverlay() {
  const token = {};
  stack.push(token);
  return {
    isTop: () => stack[stack.length - 1] === token,
    release: () => {
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
    },
  };
}

/**
 * Shared dismissal wiring for a full-screen overlay:
 *
 * - Escape closes the overlay only when it is the TOP open overlay.
 * - A history sentinel is pushed while open so Android/browser back closes
 *   the top overlay instead of navigating the page away; the sentinel is
 *   popped on cleanup when the overlay closes any other way (chevron, swipe,
 *   Esc, scrim) so history stays balanced.
 *
 * @param {boolean} active Whether the overlay is currently open.
 * @param {() => void} onClose Close request callback (latest value is used).
 * @param {string} historyKey Unique `history.state` flag for this overlay.
 */
export function useOverlayDismissal(active, onClose, historyKey) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;
    const reg = registerOverlay();
    const onKey = (e) => {
      if (e.key === 'Escape' && reg.isTop()) closeRef.current?.();
    };
    const onPop = () => {
      // Close only when THIS overlay's sentinel was the one popped: we are
      // the top overlay and our flag is no longer in history.state. (A pop
      // that still shows our flag was another overlay's cleanup popping its
      // own sentinel above ours — not a user back-press aimed at us.)
      if (
        reg.isTop() &&
        !(window.history.state && window.history.state[historyKey])
      ) {
        closeRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    // Push the sentinel from a task, not synchronously: StrictMode double-runs
    // a mounting effect, and a synchronous push would make the first cleanup's
    // async history.back() land as a popstate on the second run's listener,
    // instantly (and wrongly) closing the overlay it just opened.
    let pushed = false;
    const t = setTimeout(() => {
      pushed = true;
      window.history.pushState({ [historyKey]: true }, '');
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      reg.release();
      if (pushed && window.history.state && window.history.state[historyKey]) {
        window.history.back();
      }
    };
  }, [active, historyKey]);
}
