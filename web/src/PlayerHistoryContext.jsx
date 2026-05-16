import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { usePlayerDetailOverlayOptional } from './PlayerDetailOverlay.jsx'
import { PlayerSeasonSlideOver } from './PlayerSeasonSlideOver.jsx';

const PlayerHistoryContext = createContext(null);

/**
 * Opens the season history slide-over. Accepts pick rows, trade legs, waiver rows, etc.
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
 */
export function PlayerHistoryProvider({ children, teamLogoMap = {}, kitIndexByEntry }) {
  const [target, setTarget] = useState(null);
  const playerDetailOverlay = usePlayerDetailOverlayOptional();

  const openPlayerHistory = useCallback((row) => {
    const element = Number(row?.element ?? row?.elementId);
    if (!Number.isFinite(element)) return;
    const displayName =
      row?.displayName ?? row?.playerFullName ?? row?.playerName ?? undefined;
    const web_name = row?.web_name ?? undefined;
    const teamShort =
      row?.teamShort ??
      row?.teamName ??
      row?.pickedTeamShort ??
      row?.droppedTeamShort ??
      undefined;
    if (playerDetailOverlay) {
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
      return;
    }
    setTarget({ element, displayName, web_name, teamShort });
  }, [playerDetailOverlay]);

  const closePlayerHistory = useCallback(() => setTarget(null), []);

  const value = useMemo(
    () => ({ openPlayerHistory }),
    [openPlayerHistory],
  );

  return (
    <PlayerHistoryContext.Provider value={value}>
      {children}
      {!playerDetailOverlay && target ? (
        <PlayerSeasonSlideOver
          target={target}
          onClose={closePlayerHistory}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : null}
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
