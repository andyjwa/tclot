import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react'
import { usePlayerDetailOverlayOptional } from './PlayerDetailOverlay.jsx'

const PlayerHistoryContext = createContext(null);

/**
 * Opens the player detail overlay (`PlayerDetailOverlay`). Accepts pick rows, trade legs, waiver rows, etc.
 *
 * The legacy `PlayerSeasonSlideOver` fallback was retired in Phase 2 — `App.jsx` always wraps the tree
 * in `PlayerDetailOverlayProvider`, so the only path is `playerDetailOverlay.openPlayerDetail(...)`. If
 * the overlay provider is somehow missing in development we log loudly so the bug surfaces immediately.
 *
 * @param {object} row
 * @param {number} [row.element]
 * @param {number} [row.elementId]
 * @param {string} [row.displayName]
 * @param {string} [row.web_name]
 * @param {string} [row.playerFullName]
 * @param {string} [row.playerName]
 * @param {string} [row.teamShort]
 * @param {string} [row.teamName]
 * @param {string} [row.pickedTeamShort]
 * @param {string} [row.droppedTeamShort]
 * @param {number} [row.leagueEntryId]
 */
export function PlayerHistoryProvider({ children }) {
  const playerDetailOverlay = usePlayerDetailOverlayOptional();

  const openPlayerHistory = useCallback((row) => {
    const element = Number(row?.element ?? row?.elementId);
    if (!Number.isFinite(element)) return;
    if (!playerDetailOverlay) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(
          '[PlayerHistoryProvider] PlayerDetailOverlayProvider is missing — cannot open player detail. ' +
            'Wrap the app in <PlayerDetailOverlayProvider> above <PlayerHistoryProvider>.',
        );
      }
      return;
    }
    const displayName =
      row?.displayName ?? row?.playerFullName ?? row?.playerName ?? undefined;
    const web_name = row?.web_name ?? undefined;
    const teamShort =
      row?.teamShort ??
      row?.teamName ??
      row?.pickedTeamShort ??
      row?.droppedTeamShort ??
      undefined;
    let leagueRaw = row?.leagueEntryId ?? null;
    if (leagueRaw != null) leagueRaw = Number(leagueRaw);
    const leagueOk = Number.isFinite(leagueRaw) ? leagueRaw : undefined;
    playerDetailOverlay.openPlayerDetail({
      element,
      ...(leagueOk != null ? { leagueEntryId: leagueOk } : {}),
      displayName,
      web_name,
      teamShort,
    });
  }, [playerDetailOverlay]);

  const value = useMemo(
    () => ({ openPlayerHistory }),
    [openPlayerHistory],
  );

  return (
    <PlayerHistoryContext.Provider value={value}>
      {children}
    </PlayerHistoryContext.Provider>
  );
}

/** @returns {{ openPlayerHistory: (row: object) => void }} */
export function usePlayerHistory() {
  const ctx = useContext(PlayerHistoryContext);
  if (!ctx) {
    throw new Error('usePlayerHistory must be used within PlayerHistoryProvider');
  }
  return ctx;
}

function useOpenPlayerHistoryOptional() {
  return useContext(PlayerHistoryContext)?.openPlayerHistory ?? null;
}

/**
 * Renders player text as a button when an FPL element id is valid and the provider is present.
 * @param {{ element: number | string | null | undefined, displayName?: string, web_name?: string, teamShort?: string, className?: string, title?: string, children: import('react').ReactNode }} props
 */
export function ClickablePlayerName({
  element,
  displayName,
  web_name,
  teamShort,
  className = '',
  title: titleProp,
  children,
}) {
  const openHistory = useOpenPlayerHistoryOptional();
  const id = Number(element);
  const canOpen = Boolean(openHistory) && Number.isFinite(id);

  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  const title =
    titleProp ??
    `${typeof children === 'string' ? children : 'Player'} — player detail`;

  return (
    <button
      type="button"
      className={`player-history-name-btn${className ? ` ${className}` : ''}`}
      title={title}
      onClick={() => {
        openHistory?.({ element: id, displayName, web_name, teamShort });
      }}
    >
      {children}
    </button>
  );
}
