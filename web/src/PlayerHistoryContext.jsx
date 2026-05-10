import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
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
    setTarget({ element, displayName, web_name, teamShort });
  }, []);

  const closePlayerHistory = useCallback(() => setTarget(null), []);

  const value = useMemo(
    () => ({ openPlayerHistory }),
    [openPlayerHistory],
  );

  return (
    <PlayerHistoryContext.Provider value={value}>
      {children}
      {target ? (
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
  const open = useOpenPlayerHistoryOptional();
  const id = Number(element);
  const can = open && Number.isFinite(id);

  if (!can) {
    return <span className={className}>{children}</span>;
  }

  const title =
    titleProp ??
    `${typeof children === 'string' ? children : 'Player'} — view season history`;

  return (
    <button
      type="button"
      className={`player-history-name-btn${className ? ` ${className}` : ''}`}
      title={title}
      onClick={() =>
        open({ element: id, displayName, web_name, teamShort })
      }
    >
      {children}
    </button>
  );
}
