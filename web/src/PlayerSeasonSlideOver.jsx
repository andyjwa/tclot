import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildElementOwnerLeagueEntryByGw } from './elementFantasyOwnerByGw.js';
import { defensiveContributionPointThreshold } from './fplBonusFromBps.js';
import { draftResourceUrl, fplApiBase } from './fplDraftUrl';
import { TeamAvatar } from './TeamAvatar.jsx';

const LEAGUE_DATA_BASE = `${import.meta.env.BASE_URL}league-data`;

/** Narrow viewports: swipe-right dismiss + viewport-left back strip (not portrait-only — landscape was hidden). */
const NARROW_OVERLAY_MEDIA = '(max-width: 900px)';
const SHEET_TRANSITION = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
const SWIPE_OPEN_GRACE_MS = 320;

/**
 * Fetch FPL element-summary (season history). Tries draft API first, then classic — same element ids.
 */
async function fetchElementSummary(elementId) {
  const id = Number(elementId);
  if (!Number.isFinite(id)) throw new Error('Invalid player id');
  const base = fplApiBase().replace(/\/$/, '');
  const urls = [`${draftResourceUrl(`element-summary/${id}`)}`, `${base}/element-summary/${id}`];
  const tried = new Set();
  let lastErr = null;
  for (const url of urls) {
    if (tried.has(url)) continue;
    tried.add(url);
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('Failed to load player history');
}

/** Gameweek index on a history row — classic API uses `round`, draft uses `event`. */
function historyGw(h) {
  if (!h || typeof h !== 'object') return NaN;
  const n = Number(h.round ?? h.event);
  return Number.isFinite(n) ? n : NaN;
}

/** Every gameweek row FPL returns for this player (current season `history`), oldest GW first. */
function normalizeHistoryRows(payload) {
  const raw = payload?.history;
  if (!Array.isArray(raw)) return [];
  return [...raw]
    .filter((h) => h && Number.isFinite(historyGw(h)))
    .sort((a, b) => historyGw(a) - historyGw(b));
}

/** Optional defensive-contribution count if draft/classic history ever exposes it. */
function historyDcCount(h) {
  const v =
    h?.defensive_contribution ??
    h?.defensive_contributions ??
    h?.dc ??
    h?.dc_count;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Emoji + optional ×n (small) for history stat columns; matches live contributions (🪖 Def Con, 🍑 assists). */
function HistoryStatBadge({ emoji, count, singularLabel, pluralLabel, empty = '—' }) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) {
    return <span className="tabular muted">{empty}</span>;
  }
  const aria =
    n === 1 ? `${n} ${singularLabel}` : `${n} ${pluralLabel}`;
  return (
    <span
      className="live-player-slide__stat-badge tabular"
      role="img"
      aria-label={aria}
      title={aria}
    >
      <span aria-hidden="true">{emoji}</span>
      {n > 1 ? (
        <span className="live-player-slide__stat-badge__mul" aria-hidden="true">
          ×{n}
        </span>
      ) : null}
    </span>
  );
}

/** Season history DC: 🪖 only when actions meet position threshold; else raw progress; ×n = full thresholds met. */
function HistoryDcCell({ dc, elementTypeId }) {
  const raw = dc == null ? NaN : Number(dc);
  if (!Number.isFinite(raw) || raw < 1) {
    return <span className="tabular muted">—</span>;
  }
  const threshold = defensiveContributionPointThreshold(elementTypeId);
  if (threshold == null) {
    return <span className="tabular">{raw}</span>;
  }
  if (raw < threshold) {
    const title = `${raw} defensive contribution${raw === 1 ? '' : 's'} — below ${threshold} this GW for Def Con FPL points`;
    return (
      <span className="tabular" title={title}>
        {raw}
      </span>
    );
  }
  const stacks = Math.floor(raw / threshold);
  return (
    <HistoryStatBadge
      emoji="🪖"
      count={stacks}
      singularLabel="defensive contribution point"
      pluralLabel="defensive contribution points"
    />
  );
}

/**
 * Slide-in panel from the right (full width on narrow viewports) with season GW history from FPL.
 *
 * @param {{ target: { element: number, displayName?: string, web_name?: string, teamShort?: string } | null, onClose: () => void, teamLogoMap?: Record<string, string>, kitIndexByEntry?: Record<number, number> }} props
 */
export function PlayerSeasonSlideOver({ target, onClose, teamLogoMap = {}, kitIndexByEntry }) {
  const sheetRef = useRef(null);
  const swipePxRef = useRef(0);
  const swipeGestureRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    lock: null,
    t0: 0,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPayload, setHistoryPayload] = useState(null);
  const [ownerMaps, setOwnerMaps] = useState(null);
  const [ownerMapsLoading, setOwnerMapsLoading] = useState(false);
  const [narrowOverlay, setNarrowOverlay] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(NARROW_OVERLAY_MEDIA).matches,
  );
  const [swipePx, setSwipePx] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);
  /** After open, defer inline `transform` so CSS slide-in still runs. */
  const [swipeInlineReady, setSwipeInlineReady] = useState(false);
  /** From `league-data/fpl-mini.json` (element-summary has no `element_type`). */
  const [elementTypeId, setElementTypeId] = useState(null);

  const elementId = target?.element ?? null;
  const titleName =
    String(target?.displayName ?? target?.web_name ?? '').trim() || `Player #${elementId ?? ''}`;

  const finishClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const onSheetTransitionEnd = useCallback(
    (e) => {
      if (e.target !== sheetRef.current || e.propertyName !== 'transform') return;
      if (!sheetOpen) finishClose();
    },
    [sheetOpen, finishClose],
  );

  useEffect(() => {
    if (!target) {
      setSheetOpen(false);
      setHistoryPayload(null);
      setError(null);
      setLoading(false);
      setOwnerMaps(null);
      setOwnerMapsLoading(false);
      return;
    }
    setSheetOpen(false);
    setHistoryPayload(null);
    setOwnerMaps(null);
    setError(null);
    let innerRaf = null;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setSheetOpen(true));
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf != null) cancelAnimationFrame(innerRaf);
    };
  }, [target]);

  /** Drop in-flight swipe when the sheet context changes — avoids stale gesture / offset. */
  useEffect(() => {
    swipeGestureRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      lock: null,
      t0: 0,
    };
    swipePxRef.current = 0;
    setSwipePx(0);
    setSwipeDragging(false);
  }, [target, sheetOpen]);

  useEffect(() => {
    if (!target || !Number.isFinite(Number(elementId))) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchElementSummary(elementId)
      .then((json) => {
        if (!cancelled) setHistoryPayload(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target, elementId]);

  useEffect(() => {
    if (!target || !Number.isFinite(Number(elementId))) {
      setElementTypeId(null);
      return;
    }
    let cancelled = false;
    setElementTypeId(null);
    const url = `${LEAGUE_DATA_BASE}/fpl-mini.json`;
    void fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        const els = json?.elements;
        if (!Array.isArray(els)) return;
        const id = Number(elementId);
        const row = els.find((e) => Number(e?.id) === id);
        const et = row?.element_type;
        if (et != null && Number.isFinite(Number(et))) setElementTypeId(Number(et));
      })
      .catch(() => {
        /* optional file / network — leave null → numeric DC only */
      });
    return () => {
      cancelled = true;
    };
  }, [target, elementId]);

  useEffect(() => {
    if (!target || !Number.isFinite(Number(elementId))) return;
    let cancelled = false;
    setOwnerMaps(null);
    setOwnerMapsLoading(true);
    void (async () => {
      try {
        const [draftR, txR, detailsR] = await Promise.all([
          fetch(`${LEAGUE_DATA_BASE}/draft_picks.json`),
          fetch(`${LEAGUE_DATA_BASE}/transactions.json`),
          fetch(`${LEAGUE_DATA_BASE}/details.json`),
        ]);
        const draftPicks = draftR.ok ? await draftR.json() : null;
        const transactions = txR.ok ? await txR.json() : null;
        const details = detailsR.ok ? await detailsR.json() : null;
        if (cancelled) return;
        const byGw = buildElementOwnerLeagueEntryByGw({
          elementId,
          draftPicks,
          transactions,
          details,
        });
        const names = new Map();
        for (const e of details?.league_entries ?? []) {
          if (e?.id != null) names.set(Number(e.id), String(e.entry_name ?? ''));
        }
        setOwnerMaps({ byGw, names });
      } catch {
        if (!cancelled) setOwnerMaps(null);
      } finally {
        if (!cancelled) setOwnerMapsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, elementId]);

  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, requestClose]);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_OVERLAY_MEDIA);
    const onChange = () => setNarrowOverlay(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!sheetOpen || !narrowOverlay) {
      setSwipeInlineReady(false);
      return;
    }
    setSwipeInlineReady(false);
    const id = window.setTimeout(
      () => setSwipeInlineReady(true),
      SWIPE_OPEN_GRACE_MS,
    );
    return () => clearTimeout(id);
  }, [sheetOpen, narrowOverlay]);

  useEffect(() => {
    swipePxRef.current = swipePx;
  }, [swipePx]);

  const endSwipePointer = useCallback((e) => {
    const g = swipeGestureRef.current;
    if (g.pointerId == null || e.pointerId !== g.pointerId) return;
    try {
      sheetRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    g.pointerId = null;
    g.lock = null;
    setSwipeDragging(false);

    const el = sheetRef.current;
    const w = el?.getBoundingClientRect().width ?? window.innerWidth;
    const px = swipePxRef.current;
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = Math.max(8, t1 - (g.t0 || t1));
    const v = px / dt;
    const threshold = Math.max(72, w * 0.2);
    const shouldClose = px >= threshold || (px > 52 && v > 0.42);

    if (shouldClose) {
      swipePxRef.current = 0;
      setSwipePx(0);
      requestClose();
    } else {
      swipePxRef.current = 0;
      setSwipePx(0);
    }
  }, [requestClose]);

  const onSheetPointerDown = useCallback(
    (e) => {
      if (!narrowOverlay || !sheetOpen) return;
      if (e.button !== 0) return;
      if (e.target.closest?.('button, a, input, textarea, select, label')) return;
      swipeGestureRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lock: null,
        t0: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
    },
    [narrowOverlay, sheetOpen],
  );

  const onSheetPointerMove = useCallback(
    (e) => {
      const g = swipeGestureRef.current;
      if (g.pointerId == null || e.pointerId !== g.pointerId) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.lock == null) {
        if (dx * dx + dy * dy < 36) return;
        // Rightward dismiss: tolerate slight diagonal (iOS) — stricter ratio was locking to vertical scroll.
        if (dx > 4 && Math.abs(dx) >= Math.abs(dy) * 0.85) {
          g.lock = 'h';
          setSwipeDragging(true);
          try {
            sheetRef.current?.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        } else if (
          Math.abs(dy) > Math.abs(dx) * 1.15 &&
          Math.abs(dy) > 6
        ) {
          g.pointerId = null;
          g.lock = 'v';
          return;
        } else {
          return;
        }
      }
      if (g.lock !== 'h') return;
      e.preventDefault();
      const w = sheetRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const x = Math.min(Math.max(0, dx), w);
      swipePxRef.current = x;
      setSwipePx(x);
    },
    [sheetOpen, narrowOverlay],
  );

  const onSheetPointerCancel = useCallback(
    (e) => {
      const g = swipeGestureRef.current;
      if (g.pointerId == null || e.pointerId !== g.pointerId) return;
      try {
        sheetRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      g.pointerId = null;
      g.lock = null;
      setSwipeDragging(false);
      swipePxRef.current = 0;
      setSwipePx(0);
    },
    [],
  );

  const useSwipeTransform =
    narrowOverlay &&
    sheetOpen &&
    (swipeInlineReady || swipeDragging || swipePx > 0);

  const sheetStyle =
    useSwipeTransform ?
      {
        transform: `translateX(${swipePx}px)`,
        transition: swipeDragging ? 'none' : SHEET_TRANSITION,
      }
    : undefined;

  if (!target || typeof document === 'undefined') return null;

  const historyRows = normalizeHistoryRows(historyPayload || {});

  return createPortal(
    <div
      className={`live-player-slide${sheetOpen ? ' live-player-slide--open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-player-slide-title"
    >
      <button
        type="button"
        className="live-player-slide__scrim"
        aria-label="Close player history"
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        className={[
          'live-player-slide__sheet',
          narrowOverlay ? 'live-player-slide__sheet--swipeable' : '',
          narrowOverlay ? 'live-player-slide__sheet--mobile-edge' : '',
          swipeDragging ? 'live-player-slide__sheet--swiping' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={sheetStyle}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={endSwipePointer}
        onPointerCancel={onSheetPointerCancel}
        /* Same as pointer up when capture drops without cancel (evaluate dismiss threshold). */
        onLostPointerCapture={endSwipePointer}
        onTransitionEnd={onSheetTransitionEnd}
      >
        <header className="live-player-slide__header">
          <button
            type="button"
            className="live-player-slide__back"
            onClick={requestClose}
            aria-label="Back to live scores"
          >
            <span className="live-player-slide__back-icon" aria-hidden="true">
              ←
            </span>
            <span className="live-player-slide__back-text">Back</span>
          </button>
          <div className="live-player-slide__title-block">
            <h2 id="live-player-slide-title" className="live-player-slide__title">
              {titleName}
            </h2>
            {target.teamShort ? (
              <p className="live-player-slide__subtitle muted">{target.teamShort}</p>
            ) : null}
          </div>
        </header>

        <div className="live-player-slide__body">
          {loading ? (
            <p className="muted">Loading season history…</p>
          ) : error ? (
            <div className="data-banner data-banner--error" role="alert">
              <strong>Could not load history.</strong> {error}
            </div>
          ) : !historyRows.length ? (
            <p className="muted">No gameweek history in this response.</p>
          ) : (
            <>
              <table className="live-player-slide__table live-player-slide__table--stats">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="live-player-slide__th-owner"
                        aria-label="Fantasy owner this gameweek"
                        title="Fantasy manager who rostered this player for this gameweek (from draft + league moves). W = waivers / unrostered."
                      />
                      <th scope="col">GW</th>
                      <th
                        scope="col"
                        className="live-player-slide__th-num"
                        title="Minutes"
                      >
                        Mins
                      </th>
                      <th
                        scope="col"
                        className="live-player-slide__th-emoji"
                        title="Defensive contributions — Def Con (when FPL includes them on this row)"
                        aria-label="Defensive contributions"
                      >
                        <span aria-hidden="true">🪖</span>
                      </th>
                      <th
                        scope="col"
                        className="live-player-slide__th-emoji"
                        title="Goals scored this gameweek"
                        aria-label="Goals"
                      >
                        <span aria-hidden="true">⚽</span>
                      </th>
                      <th
                        scope="col"
                        className="live-player-slide__th-emoji"
                        title="Assists this gameweek"
                        aria-label="Assists"
                      >
                        <span aria-hidden="true">🍑</span>
                      </th>
                      <th
                        scope="col"
                        className="live-player-slide__th-num"
                        title="Bonus points"
                      >
                        Bonus
                      </th>
                      <th
                        scope="col"
                        className="live-player-slide__th-num live-player-slide__th-pts"
                        title="Total FPL points this gameweek"
                      >
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h, i) => {
                      const round = historyGw(h);
                      const dc = historyDcCount(h);
                      let ownerCell = (
                        <span className="live-player-slide__owner-placeholder muted" aria-hidden>
                          —
                        </span>
                      );
                      if (!ownerMapsLoading && ownerMaps?.byGw && Number.isFinite(round)) {
                        const lid = ownerMaps.byGw.get(round);
                        if (lid != null) {
                          const tname = ownerMaps.names?.get(lid) ?? '';
                          ownerCell = (
                            <TeamAvatar
                              entryId={lid}
                              name={tname}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                          );
                        } else {
                          ownerCell = (
                            <abbr className="live-player-slide__waiver-wire" title="Waivers / unrostered">
                              W
                            </abbr>
                          );
                        }
                      }
                      return (
                        <tr key={`${round}-${i}`}>
                          <td className="live-player-slide__td-owner">{ownerCell}</td>
                          <td className="tabular live-player-slide__td-gw">
                            {Number.isFinite(round) ? round : '—'}
                          </td>
                          <td className="tabular">{h.minutes ?? '—'}</td>
                          <td className="tabular live-player-slide__td-stat">
                            <HistoryDcCell dc={dc} elementTypeId={elementTypeId} />
                          </td>
                          <td className="tabular live-player-slide__td-stat">
                            <HistoryStatBadge
                              emoji="⚽"
                              count={h.goals_scored}
                              singularLabel="goal"
                              pluralLabel="goals"
                            />
                          </td>
                          <td className="tabular live-player-slide__td-stat">
                            <HistoryStatBadge
                              emoji="🍑"
                              count={h.assists}
                              singularLabel="assist"
                              pluralLabel="assists"
                            />
                          </td>
                          <td className="tabular">{h.bonus ?? 0}</td>
                          <td className="tabular live-player-slide__td-pts">
                            <strong>{h.total_points ?? '—'}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      {narrowOverlay && sheetOpen ?
        <button
          type="button"
          className="live-player-slide__edge-dismiss"
          aria-label="Back to previous view"
          onClick={requestClose}
        >
          <span className="live-player-slide__edge-dismiss__rule" aria-hidden="true" />
          <span className="live-player-slide__edge-dismiss__chev" aria-hidden="true">
            ‹
          </span>
        </button>
      : null}
    </div>,
    document.body,
  );
}
