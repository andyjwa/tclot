import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildElementOwnerLeagueEntryByGw } from './elementFantasyOwnerByGw.js';
import { draftResourceUrl, fplApiBase } from './fplDraftUrl';
import { TeamAvatar } from './TeamAvatar.jsx';

const LEAGUE_DATA_BASE = `${import.meta.env.BASE_URL}league-data`;

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

/** Every gameweek row FPL returns for this player (current season `history`), oldest GW first. */
function normalizeHistoryRows(payload) {
  const raw = payload?.history;
  if (!Array.isArray(raw)) return [];
  return [...raw]
    .filter((h) => h && Number.isFinite(Number(h.round)))
    .sort((a, b) => Number(a.round) - Number(b.round));
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

/**
 * Slide-in panel from the right (full width on narrow viewports) with season GW history from FPL.
 *
 * @param {{ target: { element: number, displayName?: string, web_name?: string, teamShort?: string } | null, onClose: () => void, teamLogoMap?: Record<string, string>, kitIndexByEntry?: Record<number, number> }} props
 */
export function PlayerSeasonSlideOver({ target, onClose, teamLogoMap = {}, kitIndexByEntry }) {
  const sheetRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPayload, setHistoryPayload] = useState(null);
  const [ownerMaps, setOwnerMaps] = useState(null);
  const [ownerMapsLoading, setOwnerMapsLoading] = useState(false);

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
    const openRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetOpen(true));
    });
    return () => cancelAnimationFrame(openRaf);
  }, [target]);

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
        className="live-player-slide__sheet"
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
              <div className="table-scroll">
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
                        className="live-player-slide__th-num"
                        title="Defensive contributions (when FPL includes them on this row)"
                      >
                        DC
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
                      const round = Number(h.round);
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
                          <td className="tabular">{dc != null ? dc : '—'}</td>
                          <td className="tabular">{h.goals_scored ?? 0}</td>
                          <td className="tabular">{h.assists ?? 0}</td>
                          <td className="tabular">{h.bonus ?? 0}</td>
                          <td className="tabular live-player-slide__td-pts">
                            <strong>{h.total_points ?? '—'}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
