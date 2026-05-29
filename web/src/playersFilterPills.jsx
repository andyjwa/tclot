import { useCallback, useEffect, useRef, useState } from 'react'
import { TeamAvatar } from './TeamAvatar.jsx'
import { usePillMenuDismiss } from './usePillMenuDismiss.js'
import {
  defaultSortDirForKey,
  defaultWireStatIdsForPosition,
  isWireStatDisabledInPicker,
  normalizeWireStatSelection,
  sortKeysForPositionFilter,
  SORT_LABELS,
  wireStatPickerDisabledReason,
  wireStatPickerLayout,
  wireStatPickerPositionTabLabel,
  wireStatSelectionIsDefaultForPosition,
  WIRE_MAX_STAT_COLUMNS,
  WIRE_POSITION_PILLS,
  POS_FILTER_ALL,
} from './playersWireList.js'

export function fantasyTeamFirstWord(fullName) {
  const t = String(fullName ?? '').trim()
  if (!t) return ''
  return t.split(/\s+/)[0] || t
}

export function plClubBadgeUrl(code) {
  return code != null
    ? `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
    : null
}

/**
 * Clears an active pill filter without opening the dropdown.
 * @param {{ onClear: () => void, label?: string }} props
 */
export function PillClearButton({ onClear, label = 'Clear selection' }) {
  return (
    <button
      type="button"
      className="players-pill-clear"
      aria-label={label}
      title={label}
      onClick={(ev) => {
        ev.stopPropagation()
        onClear()
      }}
    >
      <span aria-hidden>×</span>
    </button>
  )
}

/**
 * Position filter dropdown for portrait wire list.
 * @param {{
 *   positionFilter: import('./playersWireList.js').PositionFilterId,
 *   onSelect: (id: import('./playersWireList.js').PositionFilterId) => void,
 *   compact?: boolean,
 * }} props
 */
export function PositionFilterPill({ positionFilter, onSelect, compact = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedLabel =
    WIRE_POSITION_PILLS.find((p) => p.id === positionFilter)?.label ?? 'All'

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const pick = (id) => {
    onSelect(id)
    dismiss()
  }

  return (
    <div className="players-position-pill" ref={rootRef}>
      <button
        type="button"
        className={`team-selection-submenu__btn players-position-pill__btn${
          positionFilter !== POS_FILTER_ALL ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          positionFilter === POS_FILTER_ALL
            ? 'Filter by position'
            : `Position filter: ${selectedLabel}`
        }
        onClick={() => setOpen((v) => !v)}
      >
        <span className="players-position-pill__label">
          {positionFilter === POS_FILTER_ALL
            ? compact
              ? 'POS'
              : 'Position'
            : selectedLabel}
        </span>
        {positionFilter !== POS_FILTER_ALL ? (
          <PillClearButton
            label="Show all positions"
            onClear={() => onSelect(POS_FILTER_ALL)}
          />
        ) : null}
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="players-menu-pill__menu" role="listbox" aria-label="Positions">
          {WIRE_POSITION_PILLS.map((pill) => {
            const active = positionFilter === pill.id
            return (
              <li key={pill.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pick(pill.id)}
                >
                  <span className="players-menu-pill__option-text">{pill.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/** @typedef {{ kind: 'fantasy', id: number } | { kind: 'pl-club', id: number }} CompareClubSource */

/**
 * Club pill for player detail compare — fantasy squads, then Premier League clubs.
 *
 * @param {{
 *   fantasyTeams: { id?: number|null, teamName?: string|null }[],
 *   plClubs: { id?: number, short_name?: string, name?: string, code?: number }[],
 *   selected: CompareClubSource | null,
 *   onSelect: (source: CompareClubSource | null) => void,
 *   logoMap: Record<string, string>,
 *   kitIndexByEntry: Record<number, number>,
 * }} props
 */
export function CompareClubSourcePill({
  fantasyTeams,
  plClubs,
  selected,
  onSelect,
  logoMap,
  kitIndexByEntry,
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedFantasy =
    selected?.kind === 'fantasy'
      ? fantasyTeams.find((t) => Number(t.id) === Number(selected.id)) ?? null
      : null

  const selectedPlClub =
    selected?.kind === 'pl-club'
      ? plClubs.find((t) => Number(t.id) === Number(selected.id)) ?? null
      : null

  const selectedBadgeUrl = selectedPlClub ? plClubBadgeUrl(selectedPlClub.code) : null
  const selectedLabel = selectedFantasy
    ? fantasyTeamFirstWord(selectedFantasy.teamName) ||
      selectedFantasy.teamName ||
      'Club'
    : selectedPlClub
      ? String(selectedPlClub.short_name ?? selectedPlClub.name ?? 'Club')
      : 'Club'

  const isActive = selected != null

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const pickFantasy = (id) => {
    onSelect({ kind: 'fantasy', id: Number(id) })
    setOpen(false)
  }

  const pickPlClub = (id) => {
    onSelect({ kind: 'pl-club', id: Number(id) })
    setOpen(false)
  }

  const pickNone = () => {
    onSelect(null)
    setOpen(false)
  }

  const fantasyActive = (id) =>
    selected?.kind === 'fantasy' && Number(selected.id) === Number(id)

  const plClubActive = (id) =>
    selected?.kind === 'pl-club' && Number(selected.id) === Number(id)

  const badgeOnly = compact && isActive

  return (
    <div
      className={`players-club-pill${badgeOnly ? ' players-club-pill--badge-only' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`team-selection-submenu__btn players-club-pill__btn${
          isActive ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          isActive ? `Club: ${selectedLabel}` : 'Choose club or fantasy squad'
        }
        onClick={() => setOpen((v) => !v)}
      >
        {selectedFantasy ? (
          <TeamAvatar
            entryId={selectedFantasy.id}
            name={selectedFantasy.teamName}
            size="sm"
            logoMap={logoMap}
            kitIndexByEntry={kitIndexByEntry}
            badgeFallback
          />
        ) : selectedBadgeUrl ? (
          <img
            src={selectedBadgeUrl}
            alt=""
            className="players-club-pill__badge"
            width={18}
            height={18}
            loading="lazy"
          />
        ) : null}
        <span className="players-club-pill__label">{selectedLabel}</span>
        {isActive ? (
          <PillClearButton
            label="Clear club selection"
            onClear={() => {
              pickNone()
            }}
          />
        ) : null}
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          className="players-menu-pill__menu players-club-pill__menu--compare"
          role="listbox"
          aria-label="Fantasy squads and clubs"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selected == null}
              className={`players-menu-pill__option${
                selected == null ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={pickNone}
            >
              <span className="players-menu-pill__option-text">All squads</span>
            </button>
          </li>
          {fantasyTeams.map((t) => {
            const tid = Number(t.id)
            const active = fantasyActive(tid)
            const label =
              fantasyTeamFirstWord(t.teamName) || t.teamName || `Team ${t.id}`
            return (
              <li key={`f-${t.id}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={t.teamName ?? undefined}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pickFantasy(tid)}
                >
                  <TeamAvatar
                    entryId={t.id}
                    name={t.teamName}
                    size="sm"
                    logoMap={logoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    badgeFallback
                  />
                  <span className="players-menu-pill__option-text">{label}</span>
                </button>
              </li>
            )
          })}
          <li role="separator" className="players-menu-pill__divider" aria-hidden />
          {plClubs.map((t) => {
            const tid = Number(t.id)
            const active = plClubActive(tid)
            const badge = plClubBadgeUrl(t.code)
            const short = String(t.short_name ?? t.name ?? '?')
            return (
              <li key={`c-${t.id}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pickPlClub(tid)}
                >
                  {badge ? (
                    <img
                      src={badge}
                      alt=""
                      className="players-club-pill__badge"
                      width={20}
                      height={20}
                      loading="lazy"
                    />
                  ) : (
                    <span className="players-club-pill__badge-fallback">{short.slice(0, 3)}</span>
                  )}
                  <span className="players-menu-pill__option-text">{short}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   teams: { id?: number|null, teamName?: string|null }[],
 *   selectedId: number | null,
 *   onSelect: (id: number | null) => void,
 *   logoMap: Record<string, string>,
 *   kitIndexByEntry: Record<number, number>,
 *   defaultLabel?: string,
 * }} props
 */
export function FantasyTeamPill({
  teams,
  selectedId,
  onSelect,
  logoMap,
  kitIndexByEntry,
  defaultLabel = 'Fantasy',
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedTeam =
    selectedId != null
      ? teams.find((t) => Number(t.id) === Number(selectedId)) ?? null
      : null

  const selectedLabel = selectedTeam
    ? fantasyTeamFirstWord(selectedTeam.teamName) ||
      selectedTeam.teamName ||
      defaultLabel
    : defaultLabel

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const pick = (id) => {
    onSelect(id === 'all' ? null : Number(id))
    setOpen(false)
  }

  const badgeOnly = compact && selectedTeam != null

  return (
    <div
      className={`players-fantasy-pill${badgeOnly ? ' players-fantasy-pill--badge-only' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`team-selection-submenu__btn players-fantasy-pill__btn${
          selectedTeam ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          selectedTeam?.teamName
            ? `Fantasy squad: ${selectedTeam.teamName}`
            : `Filter by ${defaultLabel.toLowerCase()}`
        }
        onClick={() => setOpen((v) => !v)}
      >
        {selectedTeam ? (
          <TeamAvatar
            entryId={selectedTeam.id}
            name={selectedTeam.teamName}
            size="sm"
            logoMap={logoMap}
            kitIndexByEntry={kitIndexByEntry}
            badgeFallback
          />
        ) : null}
        <span className="players-fantasy-pill__label">{selectedLabel}</span>
        {selectedTeam ? (
          <PillClearButton
            label="Show all squads"
            onClear={() => onSelect(null)}
          />
        ) : null}
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="players-menu-pill__menu" role="listbox" aria-label="Fantasy squads">
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selectedId == null}
              className={`players-menu-pill__option${
                selectedId == null ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick('all')}
            >
              <span className="players-menu-pill__option-text">All squads</span>
            </button>
          </li>
          {teams.map((t) => {
            const tid = Number(t.id)
            const active = Number(selectedId) === tid
            const label =
              fantasyTeamFirstWord(t.teamName) || t.teamName || `Team ${t.id}`
            return (
              <li key={t.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={t.teamName ?? undefined}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pick(tid)}
                >
                  <TeamAvatar
                    entryId={t.id}
                    name={t.teamName}
                    size="sm"
                    logoMap={logoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    badgeFallback
                  />
                  <span className="players-menu-pill__option-text">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function compareOptionShortLabel(label) {
  const s = String(label ?? '').trim()
  const idx = s.indexOf(' (')
  return idx >= 0 ? s.slice(0, idx) : s
}

/**
 * Searchable compare-player picker for wire detail toolbar.
 *
 * @param {{
 *   options: { id: number, label: string }[],
 *   selectedId: number | null,
 *   onSelect: (id: number | null) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 *   positionLabel?: string,
 *   hideSelectedText?: boolean,
 * }} props
 */
export function ComparePlayerSearch({
  options,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = 'Find a player…',
  positionLabel = '',
  hideSelectedText = false,
  compact = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const selected =
    selectedId != null
      ? options.find((o) => Number(o.id) === Number(selectedId)) ?? null
      : null

  useEffect(() => {
    if (hideSelectedText) {
      if (!open) setQuery('')
      return
    }
    if (selected) {
      setQuery(compareOptionShortLabel(selected.label))
    } else if (!open) {
      setQuery('')
    }
  }, [selectedId, selected, open, hideSelectedText])

  const collapseIfIdle = useCallback(() => {
    if (compact && !query.trim()) setExpanded(false)
  }, [compact, query])

  const dismiss = useCallback(() => {
    setOpen(false)
    collapseIfIdle()
  }, [collapseIfIdle])
  usePillMenuDismiss(rootRef, open, dismiss)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options

  const pick = (id) => {
    onSelect(id)
    setOpen(false)
    if (compact && !id) collapseIfIdle()
    else if (compact) setExpanded(false)
  }

  const showCollapsedTrigger = compact && !expanded && !query.trim() && !open

  const expandSearch = () => {
    if (disabled) return
    setExpanded(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleInputBlur = () => {
    requestAnimationFrame(() => {
      if (rootRef.current?.contains(document.activeElement)) return
      if (!query.trim() && !open) collapseIfIdle()
    })
  }

  return (
    <div
      className={`players-compare-search${
        disabled ? ' players-compare-search--disabled' : ''
      }${compact ? ' players-compare-search--compact' : ''}${
        showCollapsedTrigger
          ? ' players-compare-search--collapsed'
          : ' players-compare-search--expanded'
      }`}
      ref={rootRef}
    >
      {showCollapsedTrigger ? (
        <button
          type="button"
          className="players-compare-search__trigger team-selection-submenu__btn"
          aria-label="Search compare player"
          disabled={disabled}
          onClick={expandSearch}
        >
          <span className="players-compare-search__trigger-icon" aria-hidden>
            🔍
          </span>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="search"
          className="players-compare-search__input"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          aria-label="Search compare player"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="players-compare-search-list"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (!e.target.value.trim()) onSelect(null)
          }}
          onFocus={() => {
            if (!disabled) {
              setExpanded(true)
              setOpen(true)
            }
          }}
          onBlur={handleInputBlur}
        />
      )}
      {open && !disabled ? (
        <ul
          id="players-compare-search-list"
          className="players-menu-pill__menu players-compare-search__menu"
          role="listbox"
          aria-label="Compare players"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selectedId == null}
              className={`players-menu-pill__option${
                selectedId == null ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick(null)}
            >
              <span className="players-menu-pill__option-text">None</span>
            </button>
          </li>
          {filtered.length ? (
            filtered.map((o) => {
              const active = Number(selectedId) === Number(o.id)
              return (
                <li key={o.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`players-menu-pill__option${
                      active ? ' players-menu-pill__option--active' : ''
                    }`}
                    onClick={() => pick(o.id)}
                  >
                    <span className="players-menu-pill__option-text">{o.label}</span>
                  </button>
                </li>
              )
            })
          ) : (
            <li role="presentation">
              <span className="players-menu-pill__option players-menu-pill__option--empty muted">
                {options.length
                  ? 'No matches'
                  : positionLabel
                    ? `No ${positionLabel} on this squad`
                    : 'No players on this squad'}
              </span>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   options: { id: number, label: string }[],
 *   selectedId: number | null,
 *   onSelect: (id: number | null) => void,
 *   positionLabel: string,
 *   displayName?: string,
 * }} props
 */
export function ComparePlayerPill({
  options,
  selectedId,
  onSelect,
  positionLabel,
  displayName,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected =
    selectedId != null
      ? options.find((o) => Number(o.id) === Number(selectedId)) ?? null
      : null

  const selectedLabel = displayName
    ? String(displayName).trim()
    : selected
      ? compareOptionShortLabel(selected.label)
      : 'Compare'

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const pick = (id) => {
    onSelect(id === 'none' ? null : Number(id))
    setOpen(false)
  }

  return (
    <div className="players-compare-pill" ref={rootRef}>
      <button
        type="button"
        className={`team-selection-submenu__btn players-compare-pill__btn${
          selected ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          selected ? `Compare player: ${selectedLabel}` : 'Choose compare player'
        }
        onClick={() => setOpen((v) => !v)}
      >
        <span className="players-compare-pill__label">{selectedLabel}</span>
        {selectedId != null ? (
          <PillClearButton
            label="Clear compare player"
            onClear={() => onSelect(null)}
          />
        ) : null}
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="players-menu-pill__menu" role="listbox" aria-label="Compare players">
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selectedId == null}
              className={`players-menu-pill__option${
                selectedId == null ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick('none')}
            >
              <span className="players-menu-pill__option-text">None</span>
            </button>
          </li>
          {options.length ? (
            options.map((o) => {
              const active = Number(selectedId) === Number(o.id)
              return (
                <li key={o.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`players-menu-pill__option${
                      active ? ' players-menu-pill__option--active' : ''
                    }`}
                    onClick={() => pick(o.id)}
                  >
                    <span className="players-menu-pill__option-text">{o.label}</span>
                  </button>
                </li>
              )
            })
          ) : (
            <li role="presentation">
              <span className="players-menu-pill__option players-menu-pill__option--empty muted">
                No {positionLabel} players
              </span>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}

function wireStatSelectionIsDefault(selectedIds, positionFilter) {
  return wireStatSelectionIsDefaultForPosition(selectedIds, positionFilter)
}

/**
 * Multi-select stat column picker for the Players wire table.
 *
 * @param {{
 *   selectedIds: string[],
 *   onChange: (ids: string[]) => void,
 *   positionFilter: import('./playersWireList.js').PositionFilterId,
 *   maxStatColumns?: number,
 * }} props
 */
export function StatsColumnsPill({
  selectedIds,
  onChange,
  positionFilter,
  maxStatColumns = WIRE_MAX_STAT_COLUMNS,
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selection = normalizeWireStatSelection(selectedIds, positionFilter, maxStatColumns)
  const atMax = selection.length >= maxStatColumns
  const isCustom = !wireStatSelectionIsDefault(selection, positionFilter)
  const { promoted, promotedLabel, hint, groups } = wireStatPickerLayout(positionFilter)
  const positionTabLabel = wireStatPickerPositionTabLabel(positionFilter)
  const positionFiltered = positionFilter !== 'all'

  const dismiss = useCallback(() => setOpen(false), [])
  const ignoreOutside = useCallback(
    (target) =>
      target instanceof Element && Boolean(target.closest('.players-bench-pos-tabs')),
    [],
  )
  usePillMenuDismiss(rootRef, open, dismiss, ignoreOutside)

  const toggleStat = (statId) => {
    if (isWireStatDisabledInPicker(statId, positionFilter)) return
    const selected = selection.includes(statId)
    if (selected) {
      if (selection.length <= 1) return
      onChange(selection.filter((id) => id !== statId))
      return
    }
    if (atMax) return
    onChange([...selection, statId])
  }

  const renderOption = (stat) => {
    const checked = selection.includes(stat.id)
    const disabled = isWireStatDisabledInPicker(stat.id, positionFilter)
    const blocked = !checked && atMax
    const inactive = disabled || blocked
    const reason = wireStatPickerDisabledReason(stat.id, positionFilter)
    const title = [
      stat.title ?? stat.label,
      disabled ? reason : blocked ? `Deselect a column first (${maxStatColumns} max)` : '',
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <label
        key={stat.id}
        className={`players-stats-pill__option${
          inactive ? ' players-stats-pill__option--disabled' : ''
        }${checked ? ' players-stats-pill__option--checked' : ''}`}
        title={title}
      >
        <input
          type="checkbox"
          className="players-stats-pill__checkbox"
          checked={checked}
          disabled={inactive && !checked}
          onChange={() => toggleStat(stat.id)}
        />
        <span className="players-stats-pill__option-label">
          {stat.label}
          {disabled && reason ? (
            <span className="players-stats-pill__option-hint">{reason}</span>
          ) : null}
        </span>
      </label>
    )
  }

  const buttonActive = isCustom

  return (
    <div
      className={`players-stats-pill${compact ? ' players-stats-pill--compact' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`team-selection-submenu__btn players-stats-pill__btn${
          buttonActive ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Table stat columns, ${selection.length} of ${maxStatColumns} selected`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="players-stats-pill__label" aria-hidden>
          <span className="players-stats-pill__label-icon">📊</span>
          <span className="players-stats-pill__label-text">Stats</span>
        </span>
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="players-stats-pill__panel"
          role="dialog"
          aria-label="Choose table stat columns"
        >
          <div className="players-stats-pill__panel-head">
            <span className="players-stats-pill__panel-title">Table columns</span>
            <span className="players-stats-pill__panel-count muted">
              {selection.length} of {maxStatColumns}
            </span>
          </div>
          <p className="players-stats-pill__panel-note muted">
            Player, Pts, and Next 3 are always shown.
          </p>
          {positionFiltered && hint ? (
            <p className="players-stats-pill__panel-context" role="status">
              <span className="players-stats-pill__context-tag">{positionTabLabel}</span>
              {hint}
            </p>
          ) : null}
          <div className="players-stats-pill__panel-body">
            {promoted.length ? (
              <section className="players-stats-pill__group players-stats-pill__group--promoted">
                <h4 className="players-stats-pill__group-label">{promotedLabel}</h4>
                <div className="players-stats-pill__grid">{promoted.map(renderOption)}</div>
              </section>
            ) : null}
            {groups.map((group) => (
              <section key={group.id} className="players-stats-pill__group">
                <h4 className="players-stats-pill__group-label">{group.label}</h4>
                <div className="players-stats-pill__grid">
                  {group.stats.map(renderOption)}
                </div>
              </section>
            ))}
          </div>
          <div className="players-stats-pill__panel-foot">
            <button
              type="button"
              className="players-stats-pill__reset"
              disabled={!isCustom}
              onClick={() => onChange([...defaultWireStatIdsForPosition(positionFilter)])}
            >
              Reset to default
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ============================================================
 * Owned filter pill — collapses the old `availableOnly` switch + FantasyTeamPill
 * into one dropdown:
 *
 *   "Free agents only"  → availableOnly=true,  myTeam=null   (default)
 *   "Any owner"         → availableOnly=false, myTeam=null
 *   ───────────────────
 *   "On my squad"       → sets myTeam = myTeamLeagueEntryId  (if available)
 *   "On {teamName}"     → per-team rows
 *
 * The pill exposes a single enum `ownedMode` derived from the underlying
 * (availableOnly, myTeam) tuple so the caller doesn't need to translate.
 * ============================================================ */

/**
 * @typedef {'free' | 'any' | 'mySquad'} OwnedScalarMode
 * @typedef {OwnedScalarMode | { teamId: number }} OwnedMode
 */

/**
 * @param {{
 *   ownedMode: OwnedMode,
 *   onOwnedModeChange: (mode: OwnedMode) => void,
 *   teams: { id?: number|null, teamName?: string|null, fplEntryId?: number|null }[],
 *   myFantasyEntryId: number | null,
 *   logoMap: Record<string, string>,
 *   kitIndexByEntry: Record<number, number>,
 *   compact?: boolean,
 *   rostersHealthy?: boolean,
 * }} props
 */
export function OwnedFilterPill({
  ownedMode,
  onOwnedModeChange,
  teams,
  myFantasyEntryId,
  logoMap,
  kitIndexByEntry,
  compact = false,
  rostersHealthy = true,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const mySquadTeam =
    myFantasyEntryId != null
      ? teams.find((t) => Number(t.id) === Number(myFantasyEntryId)) ?? null
      : null

  const activeTeam =
    typeof ownedMode === 'object' && ownedMode != null
      ? teams.find((t) => Number(t.id) === Number(ownedMode.teamId)) ?? null
      : null

  let activeLabel = 'Free agents'
  if (ownedMode === 'any') activeLabel = 'Any owner'
  else if (ownedMode === 'mySquad') {
    activeLabel = 'On my squad'
  } else if (typeof ownedMode === 'object' && activeTeam) {
    const short =
      fantasyTeamFirstWord(activeTeam.teamName) ||
      activeTeam.teamName ||
      `Team ${activeTeam.id}`
    activeLabel = `On ${short}`
  } else if (ownedMode === 'free') {
    activeLabel = compact ? 'Free agents' : 'Free agents only'
  }

  // Active state surfaces "narrowed view" — every option except "Any owner"
  // is treated as an active filter.
  const isActive = ownedMode !== 'any'

  const pick = (mode) => {
    onOwnedModeChange(mode)
    dismiss()
  }

  const isMySquadActive = ownedMode === 'mySquad'
  const teamActiveId =
    typeof ownedMode === 'object' && ownedMode != null
      ? Number(ownedMode.teamId)
      : null

  return (
    <div className="players-owned-pill" ref={rootRef}>
      <button
        type="button"
        className={`team-selection-submenu__btn players-owned-pill__btn${
          isActive ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Owned filter: ${activeLabel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="players-owned-pill__label">
          <span className="players-owned-pill__label-text">
            <span className="players-owned-pill__label-key">Owned</span>
            <span className="players-owned-pill__label-value">{activeLabel}</span>
          </span>
        </span>
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          className="players-menu-pill__menu"
          role="listbox"
          aria-label="Owned filter"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={ownedMode === 'free'}
              className={`players-menu-pill__option${
                ownedMode === 'free' ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick('free')}
              disabled={!rostersHealthy}
              title={!rostersHealthy ? 'Needs roster data' : undefined}
            >
              <span className="players-menu-pill__option-text">Free agents only</span>
            </button>
          </li>
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={ownedMode === 'any'}
              className={`players-menu-pill__option${
                ownedMode === 'any' ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick('any')}
            >
              <span className="players-menu-pill__option-text">Any owner</span>
            </button>
          </li>
          {(mySquadTeam || teams.length) ? (
            <li
              role="separator"
              className="players-menu-pill__divider"
              aria-hidden
            />
          ) : null}
          {mySquadTeam ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isMySquadActive}
                className={`players-menu-pill__option${
                  isMySquadActive ? ' players-menu-pill__option--active' : ''
                }`}
                onClick={() => pick('mySquad')}
              >
                <TeamAvatar
                  entryId={mySquadTeam.id}
                  name={mySquadTeam.teamName}
                  size="sm"
                  logoMap={logoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  badgeFallback
                />
                <span className="players-menu-pill__option-text">On my squad</span>
              </button>
            </li>
          ) : null}
          {teams
            .filter((t) => {
              const tid = Number(t.id)
              if (!Number.isFinite(tid)) return false
              // Exclude my squad from the per-team list — it has its own row above.
              if (
                myFantasyEntryId != null &&
                Number(myFantasyEntryId) === tid
              ) {
                return false
              }
              return true
            })
            .map((t) => {
              const tid = Number(t.id)
              const active = teamActiveId === tid
              const short =
                fantasyTeamFirstWord(t.teamName) || t.teamName || `Team ${t.id}`
              return (
                <li key={t.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={t.teamName ?? undefined}
                    className={`players-menu-pill__option${
                      active ? ' players-menu-pill__option--active' : ''
                    }`}
                    onClick={() => pick({ teamId: tid })}
                  >
                    <TeamAvatar
                      entryId={t.id}
                      name={t.teamName}
                      size="sm"
                      logoMap={logoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      badgeFallback
                    />
                    <span className="players-menu-pill__option-text">{`On ${short}`}</span>
                  </button>
                </li>
              )
            })}
        </ul>
      ) : null}
    </div>
  )
}

/* ============================================================
 * Sort pill — mirrors header-click sort. Trigger: "Sort · {label} {↓|↑}";
 * dropdown lists keys returned by `sortKeysForPositionFilter(positionFilter)`.
 * ============================================================ */

/**
 * @param {{
 *   sortKey: import('./playersWireList.js').WireSortKey,
 *   sortDir: import('./playersWireList.js').WireSortDir,
 *   onSortKeyChange: (key: import('./playersWireList.js').WireSortKey) => void,
 *   onSortDirChange: (dir: import('./playersWireList.js').WireSortDir) => void,
 *   positionFilter: import('./playersWireList.js').PositionFilterId,
 * }} props
 */
export function SortPill({
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  positionFilter,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const keys = sortKeysForPositionFilter(positionFilter)
  const arrow = sortDir === 'asc' ? '↑' : '↓'
  const activeLabel = `${SORT_LABELS[sortKey] ?? 'Total pts'} ${arrow}`

  const pickKey = (key) => {
    if (key === sortKey) {
      onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      onSortKeyChange(key)
      onSortDirChange(defaultSortDirForKey(key))
    }
    dismiss()
  }

  const flipDir = () => {
    onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')
  }

  return (
    <div className="players-sort-pill" ref={rootRef}>
      <button
        type="button"
        className={`team-selection-submenu__btn players-sort-pill__btn${
          open ? ' players-menu-pill__btn--open' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort: ${activeLabel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="players-sort-pill__label">
          <span className="players-sort-pill__label-text">
            <span className="players-sort-pill__label-key">Sort</span>
            <span className="players-sort-pill__label-value">{activeLabel}</span>
          </span>
        </span>
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          className="players-menu-pill__menu"
          role="listbox"
          aria-label="Sort by"
        >
          {keys.map((key) => {
            const active = key === sortKey
            return (
              <li key={key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pickKey(key)}
                >
                  <span className="players-menu-pill__option-text">
                    {SORT_LABELS[key] ?? key}
                  </span>
                  {active ? (
                    <span aria-hidden style={{ marginLeft: 'auto', opacity: 0.85 }}>
                      {arrow}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
          <li role="separator" className="players-menu-pill__divider" aria-hidden />
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="players-menu-pill__option"
              onClick={() => {
                flipDir()
                dismiss()
              }}
            >
              <span className="players-menu-pill__option-text">
                Reverse direction ({arrow})
              </span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}

/* ============================================================
 * Include-drafted toggle — iOS-style pill switch. Internally inverse of
 * `availableOnly` for the Free / Any spectrum; disabled when the parent
 * has narrowed ownership to a specific team (decision 9).
 * ============================================================ */

/**
 * @param {{
 *   checked: boolean,
 *   onChange: (next: boolean) => void,
 *   disabled?: boolean,
 *   compact?: boolean,
 * }} props
 */
export function IncludeDraftedToggle({ checked, onChange, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Include drafted players"
      disabled={disabled}
      className={`players-include-drafted${compact ? ' players-include-drafted--sm' : ''}${
        disabled ? ' players-include-drafted--disabled' : ''
      }`}
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
    >
      <span className="players-include-drafted__track" aria-hidden>
        <span className="players-include-drafted__thumb" />
      </span>
      <span className="players-include-drafted__label">Include drafted</span>
    </button>
  )
}
