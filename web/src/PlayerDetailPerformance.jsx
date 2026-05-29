import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_PERFORMANCE_COL_IDS,
  fdrTone,
  formatPerformanceStat,
  performanceStatCatalog,
  performanceStatValue,
  performanceTableRows,
  statCellTone,
} from './playerDetailDerivations.js'

function CaretIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 8L2 4h8z" />
    </svg>
  )
}

function ColumnsPill({ visibleCount, totalCount, onClick, open }) {
  return (
    <button
      type="button"
      className={'pperf-pill' + (open ? ' is-open' : '')}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="pperf-pill__icon" aria-hidden>📊</span>
      <span className="pperf-pill__label">Columns</span>
      <span className="pperf-pill__value">{visibleCount} of {totalCount}</span>
      <CaretIcon />
    </button>
  )
}

function ColumnsPicker({ catalog, visibleIds, onChange, onClose }) {
  const handleToggle = (id) => {
    const set = new Set(visibleIds)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    const next = catalog.map((c) => c.id).filter((id2) => set.has(id2))
    onChange(next)
  }

  return (
    <div
      className="pperf-popover"
      role="dialog"
      aria-label="Performance columns"
    >
      <div className="pperf-popover__h">
        <span>Stat columns</span>
        <button
          type="button"
          className="pperf-popover__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="pperf-popover__grid">
        {catalog.map((c) => {
          const checked = visibleIds.includes(c.id)
          return (
            <label key={c.id} className="pperf-popover__opt">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(c.id)}
              />
              <span className="pperf-popover__opt-label">
                <span className="pperf-popover__opt-code">{c.label}</span>
                <span className="pperf-popover__opt-desc">{c.title}</span>
              </span>
            </label>
          )
        })}
      </div>
      <div className="pperf-popover__f">
        <button
          type="button"
          className="pperf-popover__btn"
          onClick={() => onChange(DEFAULT_PERFORMANCE_COL_IDS)}
        >
          Reset to default
        </button>
      </div>
    </div>
  )
}

/**
 * Per-GW performance table — Variant A locked spec. 7 default visible
 * columns from a 15-stat catalog, FDR pip on the right when included,
 * stat-cell colouring matching LiveScores rules
 * (`statCellTone` in `playerDetailDerivations.js`).
 *
 * @param {{
 *   el: object,
 *   summaryPayload: object | null,
 *   teamById: Map<number, object> | null | undefined,
 * }} props
 */
export function PlayerDetailPerformance({ el, summaryPayload, teamById }) {
  const catalog = useMemo(() => performanceStatCatalog(), [])
  const [visibleIds, setVisibleIds] = useState(DEFAULT_PERFORMANCE_COL_IDS)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const rows = useMemo(() => performanceTableRows(summaryPayload), [summaryPayload])
  const visibleColumns = useMemo(
    () => catalog.filter((c) => visibleIds.includes(c.id)),
    [catalog, visibleIds],
  )
  const elementType = el?.element_type
  const playerTeamId = Number(el?.team)

  /*
   * Auto-scroll on Performance tab activation: position the most recent
   * completed GW row near the top of the visible area so the latest data
   * is immediately readable instead of forcing the user to scroll past
   * GW 1. Component remounts when switching tabs, so the effect fires
   * exactly once per activation; `didAutoScrollRef` guards against firing
   * twice if `rows` changes mid-mount (e.g. summary payload arrives
   * after first paint). Subsequent user scrolls aren't fought because
   * we never re-trigger after the initial scroll for this mount.
   *
   * "Last completed GW" = highest `gw` where `kind === 'past'`. Scroll
   * is applied via manual `scrollTop` on the table-wrap (see effect
   * below) instead of `scrollIntoView` so the scroll is scoped to the
   * inner container only.
   */
  const tableWrapRef = useRef(null)
  const lastPastRowRef = useRef(null)
  const didAutoScrollRef = useRef(false)
  const lastPastGw = useMemo(() => {
    let max = null
    for (const row of rows) {
      if (row.kind === 'past' && (max == null || row.gw > max)) max = row.gw
    }
    return max
  }, [rows])

  useEffect(() => {
    if (didAutoScrollRef.current) return
    if (lastPastGw == null) return
    const wrap = tableWrapRef.current
    const row = lastPastRowRef.current
    if (!wrap || !row) return
    didAutoScrollRef.current = true
    /*
     * Use manual `scrollTop` rather than `scrollIntoView` so the scroll
     * is scoped to the table-wrap container only. `scrollIntoView`
     * walks up *every* scrollable ancestor (`.pdetail__main`,
     * `.pdetail-host`, document) and scrolls each one — that briefly
     * scrolled the whole panel out from under the user during round-3
     * verification. `offsetTop` here is relative to the wrap's offset
     * parent (`<table>`), which itself sits at offsetTop 0 inside the
     * wrap, so the row's offset within the wrap is `offsetTop`. Sticky
     * `<th>` height (~38px) is subtracted so the row sits just below
     * the pinned header rather than under it.
     */
    const stickyHeader = wrap.querySelector('thead')
    const headerHeight = stickyHeader instanceof HTMLElement ? stickyHeader.offsetHeight : 0
    const target = Math.max(0, row.offsetTop - headerHeight - 4)
    wrap.scrollTop = target
  }, [lastPastGw])

  return (
    <div className="pperf">
      <div className="pperf__h">
        <h4 className="pperf__title">Per-gameweek performance</h4>
        <div ref={wrapRef} className="pperf__h-actions">
          <ColumnsPill
            visibleCount={visibleIds.length}
            totalCount={catalog.length}
            onClick={() => setOpen((v) => !v)}
            open={open}
          />
          {open ? (
            <ColumnsPicker
              catalog={catalog}
              visibleIds={visibleIds}
              onChange={setVisibleIds}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </div>
      </div>

      <div ref={tableWrapRef} className="pperf__table-wrap">
        <table className="pperf__table" aria-label="Per-gameweek performance">
          <thead>
            <tr>
              <th scope="col" className="pperf__th pperf__th--gw">GW</th>
              <th scope="col" className="pperf__th pperf__th--opp">OPP</th>
              {visibleColumns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={
                    'pperf__th pperf__th--num' +
                    (c.id === 'pts' ? ' pperf__th--pts' : '') +
                    (c.id === 'fdr' ? ' pperf__th--fdr' : '')
                  }
                  title={c.title}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2 + visibleColumns.length} className="pperf__empty">
                  No gameweek data available.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const oppCell = renderOppCell(row, teamById, playerTeamId)
              const isPast = row.kind === 'past'
              const minutes = isPast
                ? Number(performanceStatValue('min', row.history)) || 0
                : null
              const dnp = isPast && minutes === 0
              const isLastPast = isPast && row.gw === lastPastGw
              return (
                <tr
                  key={row.gw}
                  ref={isLastPast ? lastPastRowRef : undefined}
                  className={
                    'pperf__row' +
                    (row.kind === 'future' ? ' pperf__row--future' : '') +
                    (dnp ? ' pperf__row--dnp' : '')
                  }
                >
                  <td className="pperf__cell pperf__cell--gw">GW{row.gw}</td>
                  <td className="pperf__cell pperf__cell--opp">{oppCell}</td>
                  {visibleColumns.map((c) => (
                    <PerformanceStatCell
                      key={c.id}
                      statId={c.id}
                      row={row}
                      elementType={elementType}
                    />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PerformanceStatCell({ statId, row, elementType }) {
  if (statId === 'fdr') {
    const diff = row.kind === 'past'
      ? deriveFdrFromHistory(row.history)
      : Number(row.fixture?.difficulty)
    const tone = fdrTone(diff)
    return (
      <td className="pperf__cell pperf__cell--num pperf__cell--fdr">
        <span className={`pdetail-fdr pperf__fdr-pip pdetail-fdr--${tone}`}>
          <span className="pdetail-fdr__opp">{tone}</span>
        </span>
      </td>
    )
  }

  if (row.kind === 'future') {
    return (
      <td className={`pperf__cell pperf__cell--num pperf__cell--${statId} pperf__cell--future`}>
        —
      </td>
    )
  }

  const value = performanceStatValue(statId, row.history)
  const tone = statCellTone(statId, value, elementType)
  const formatted = formatPerformanceStat(statId, value)
  const isZero = value === 0
  const ptsClass = statId === 'pts' ? ' pperf__cell--pts' : ''
  const muteClass = isZero && statId !== 'pts' ? ' pperf__cell--mute' : ''
  return (
    <td
      className={
        `pperf__cell pperf__cell--num pperf__cell--${statId}` +
        (tone === 'good' ? ` pperf__cell--good pperf__cell--${statId}-good` : '') +
        ptsClass +
        muteClass
      }
    >
      {formatted}
    </td>
  )
}

function renderOppCell(row, teamById, playerTeamId) {
  if (row.kind === 'past' && row.history) {
    const oppId = Number(row.history.opponent_team)
    const opp = lookupTeam(teamById, oppId)
    const home = Boolean(row.history.was_home)
    return (
      <OppBadge
        teamCode={opp?.code}
        short={opp?.short_name ?? '?'}
        home={home}
        extras={row.extras}
      />
    )
  }
  if (row.fixture) {
    const f = row.fixture
    const isHome = f.is_home != null
      ? Boolean(f.is_home)
      : Number(f.team_h) === playerTeamId
    const oppId = isHome ? Number(f.team_a) : Number(f.team_h)
    const opp = lookupTeam(teamById, oppId)
    return (
      <OppBadge
        teamCode={opp?.code}
        short={opp?.short_name ?? '?'}
        home={isHome}
      />
    )
  }
  return <span className="pperf__cell-mute">—</span>
}

function lookupTeam(teamById, oppId) {
  if (!teamById) return null
  if (typeof teamById.get === 'function') return teamById.get(oppId) ?? null
  return teamById?.[oppId] ?? null
}

function OppBadge({ teamCode, short, home, extras }) {
  const badge = teamCode != null
    ? `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`
    : null
  return (
    <span className="pperf__opp">
      <span className="pperf__opp-crest" aria-hidden>
        {badge ? <img src={badge} alt="" loading="lazy" decoding="async" /> : null}
      </span>
      <span className="pperf__opp-short">{short}</span>
      <span
        className={
          'pperf__opp-ha-dot' +
          (home ? ' pperf__opp-ha-dot--home' : ' pperf__opp-ha-dot--away')
        }
        aria-label={home ? 'Home' : 'Away'}
        title={home ? 'Home' : 'Away'}
      />
      {extras && extras.length > 0 ? (
        <span className="pperf__opp-extra">+{extras.length}</span>
      ) : null}
    </span>
  )
}

function deriveFdrFromHistory(historyRow) {
  if (!historyRow) return 3
  const v = Number(historyRow.fixture_difficulty ?? historyRow.difficulty)
  if (Number.isFinite(v)) return v
  return 3
}
