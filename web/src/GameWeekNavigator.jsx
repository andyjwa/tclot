import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * GameWeekNavigator — production navigator for the FPL Live page.
 *
 * Replaces the legacy `<select>`-based toolbar with a Variant-3 chevron pair +
 * clickable center pill that opens a popover grid of all GW chips.
 *
 * Visual + behavioural spec lives in `Mockup.jsx` / `Mockup.css` under the
 * `GW NAVIGATION · VARIANTS` section (V3). The production CSS for this
 * component lives in `App.css` under the `.gw-nav` block.
 *
 * @typedef {Object} GwOption
 * @property {number} id
 * @property {string} [label]
 * @property {boolean} [finished]
 * @property {boolean} [is_current]
 * @property {boolean} [is_next]
 *
 * @param {Object} props
 * @param {number | string} props.gameweek            Currently selected GW.
 * @param {GwOption[]}      props.gwOptions           All available GWs (typically 1..38).
 * @param {(id: number) => void} props.onGameweekChange  Selection callback.
 * @param {boolean}         [props.sticky=false]      If true, applies `--sticky`
 *   modifier so the row sticks to the section chrome on scroll (mobile live page).
 */
export function GameWeekNavigator({
  gameweek,
  gwOptions,
  onGameweekChange,
  sticky = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const popoverId = useId();

  const sortedOptions = useMemo(() => {
    const list = Array.isArray(gwOptions) ? gwOptions.slice() : [];
    list.sort((a, b) => Number(a.id) - Number(b.id));
    return list;
  }, [gwOptions]);

  const currentGw = Number(gameweek);

  const prevGw = useMemo(() => {
    let best = null;
    for (const o of sortedOptions) {
      const id = Number(o.id);
      if (id < currentGw && (best == null || id > best)) best = id;
    }
    return best;
  }, [sortedOptions, currentGw]);

  const nextGw = useMemo(() => {
    let best = null;
    for (const o of sortedOptions) {
      const id = Number(o.id);
      if (id > currentGw && (best == null || id < best)) best = id;
    }
    return best;
  }, [sortedOptions, currentGw]);

  const close = useCallback((opts = {}) => {
    setOpen(false);
    if (opts.returnFocus !== false) {
      triggerRef.current?.focus();
    }
  }, []);

  const handleSelect = useCallback(
    (id) => {
      onGameweekChange(Number(id));
      close();
    },
    [onGameweekChange, close],
  );

  // Outside click → close (no focus return; user clicked elsewhere intentionally).
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // ESC to close + focus trigger; focus active chip on open.
  useEffect(() => {
    if (!open) return undefined;
    const popover = popoverRef.current;
    const activeChip = popover?.querySelector('[data-gw-active="true"]');
    activeChip?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const triggerLabel = `Game Week ${Number.isFinite(currentGw) ? currentGw : ''}`.trim();

  return (
    <div
      ref={rootRef}
      className={'gw-nav' + (sticky ? ' gw-nav--sticky' : '')}
    >
      <button
        type="button"
        className="gw-nav__chev"
        aria-label="Previous game week"
        onClick={() => prevGw != null && onGameweekChange(prevGw)}
        disabled={prevGw == null}
      >
        <ChevronLeft width={14} height={14} />
      </button>
      <button
        ref={triggerRef}
        type="button"
        className="gw-nav__label"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{triggerLabel}</span>
        <ChevronDown width={12} height={12} className="gw-nav__caret" />
      </button>
      <button
        type="button"
        className="gw-nav__chev"
        aria-label="Next game week"
        onClick={() => nextGw != null && onGameweekChange(nextGw)}
        disabled={nextGw == null}
      >
        <ChevronRight width={14} height={14} />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          id={popoverId}
          className="gw-nav__popover"
          role="dialog"
          aria-label="Select game week"
        >
          <div
            className="gw-nav__grid"
            role="listbox"
            aria-label="Choose game week"
          >
            {sortedOptions.map((o) => {
              const id = Number(o.id);
              const isActive = id === currentGw;
              const isPast = id < currentGw;
              const cls =
                'gw-nav__cell' +
                (isActive ? ' is-active' : '') +
                (isPast ? ' is-past' : '');
              return (
                <button
                  key={id}
                  type="button"
                  className={cls}
                  role="option"
                  aria-selected={isActive}
                  data-gw-active={isActive ? 'true' : undefined}
                  onClick={() => handleSelect(id)}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronLeft(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronDown(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
