import { useCallback, useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar.jsx'
import { PlayerKit } from './PlayerKit.jsx'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { gameWeekSelectLabel } from './gwLabel.js'
import {
  flattenWaiverGroups,
  sortGroupsByTeamName,
  sortMovesWaiverThenFa,
} from './waiverMovesSort.js'

function teamFirstToken(teamName) {
  const t = (teamName ?? '').trim()
  if (!t) return '?'
  return t.split(/\s+/)[0]
}

/** Plain-text line for one move — no `W` prefix for waivers; FA lines keep `FA`. */
function moveLineForCopy(r) {
  const inN = r.pickedName ?? '—'
  const outN = r.droppedName ?? '—'
  const ord =
    r.waiverProcessOrder != null && Number.isFinite(Number(r.waiverProcessOrder))
      ? `${r.waiverProcessOrder}. `
      : ''
  if (r.transactionKind === 'f') {
    return `${ord}FA ${inN} ← ${outN}`
  }
  return `${ord}${inN} ← ${outN}`
}

/**
 * @param {{ gw: number | null, layoutMode: 'league' | 'team', flatRows: Array<object>, teamGroups: Array<object>, leagueTitleAbbr: string, leagueTitle: string }} args
 */
function buildWaiverShareText({
  gw,
  layoutMode,
  flatRows,
  teamGroups,
  leagueTitleAbbr,
  leagueTitle,
}) {
  if (gw == null) return ''
  if (layoutMode === 'league' && !flatRows?.length) return ''
  if (layoutMode === 'team' && !teamGroups?.length) return ''

  const lines = []
  lines.push(`${leagueTitleAbbr} · GW ${gw}`)
  lines.push(leagueTitle)
  lines.push('')

  if (layoutMode === 'league') {
    for (const r of flatRows) {
      const who = teamFirstToken(r.teamName)
      lines.push(`${moveLineForCopy(r)}  |  ${who}`)
    }
  } else {
    for (const g of teamGroups) {
      lines.push(g.teamName)
      for (const r of g.moves) {
        lines.push(`  ${moveLineForCopy(r)}`)
      }
      lines.push('')
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd()
}

function CompactMoveLine({
  r,
  showTeamColumn,
  teamLogoMap,
  kitIndexByEntry,
}) {
  return (
    <li
      className={
        showTeamColumn
          ? 'waiver-summary-share__compact-line'
          : 'waiver-summary-share__compact-line waiver-summary-share__compact-line--solo'
      }
    >
      <div className="waiver-summary-share__compact-main">
        {r.waiverProcessOrder != null ? (
          <span className="waiver-summary-share__compact-rank tabular">
            {r.waiverProcessOrder}.{' '}
          </span>
        ) : null}
        <div className="waiver-summary-share__kind-with-kit">
          <span
            className={
              r.transactionKind === 'f'
                ? 'waiver-summary-share__kind waiver-summary-share__kind--fa'
                : 'waiver-summary-share__kind'
            }
          >
            {r.transactionKind === 'f' ? 'FA' : 'W'}
          </span>
          <PlayerKit
            shirtUrl={r.pickedShirtUrl}
            badgeUrl={r.pickedBadgeUrl}
            teamShort={r.pickedTeamShort}
          />
        </div>
        <span className="waiver-summary-share__compact-pick">
          <ClickablePlayerName
            element={r.element_in}
            web_name={r.pickedName}
            teamShort={r.pickedTeamShort}
          >
            {r.pickedName ?? '—'}
          </ClickablePlayerName>{' '}
          <span className="waiver-summary-share__compact-arrow">←</span>{' '}
          <span className="muted">
            <ClickablePlayerName
              element={r.element_out}
              web_name={r.droppedName}
              teamShort={r.droppedTeamShort}
            >
              {r.droppedName ?? '—'}
            </ClickablePlayerName>
          </span>
        </span>
      </div>
      {showTeamColumn ? (
        <div className="waiver-summary-share__compact-team">
          <span className="waiver-summary-share__compact-first muted">
            {teamFirstToken(r.teamName)}
          </span>
          <TeamAvatar
            entryId={r.leagueEntryId}
            name={r.teamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        </div>
      ) : null}
    </li>
  )
}

/**
 * Compact waiver summary: copy-friendly; optional league order vs by team.
 */
export function WaiverSummaryShare({
  gw,
  groups,
  leagueTitleAbbr,
  leagueTitle,
  teamLogoMap = {},
  kitIndexByEntry = {},
  gwPickerOptions = [],
  gwValue,
  onGwChange,
}) {
  const [copied, setCopied] = useState(false)
  const [layoutMode, setLayoutMode] = useState('league')

  const flatRows = useMemo(() => {
    const f = flattenWaiverGroups(groups)
    return f.sort(sortMovesWaiverThenFa)
  }, [groups])

  const teamGroups = useMemo(() => sortGroupsByTeamName(groups), [groups])

  const shareText = useMemo(
    () =>
      buildWaiverShareText({
        gw,
        layoutMode,
        flatRows,
        teamGroups,
        leagueTitleAbbr,
        leagueTitle,
      }),
    [gw, layoutMode, flatRows, teamGroups, leagueTitleAbbr, leagueTitle],
  )

  const onCopy = useCallback(async () => {
    if (!shareText) return
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = shareText
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2200)
      } catch {
        /* ignore */
      }
    }
  }, [shareText])

  if (gw == null) {
    return <p className="muted muted--tight">Pick a gameweek when waiver data is available.</p>
  }

  if (!flatRows.length) {
    return (
      <p className="muted muted--tight">
        No waiver or free-agency moves in GW {gw} to summarize.
      </p>
    )
  }

  return (
    <div className="waiver-summary-share">
      <div className="waiver-summary-share__toolbar">
        <div className="waiver-summary-share__toolbar-row waiver-summary-share__toolbar-row--primary">
          {gwPickerOptions.length > 0 && gwValue != null && onGwChange ? (
            <select
              className="tile-gw-select tile-gw-select--inline waiver-summary-share__gw-select"
              aria-label="Waivers game week"
              value={gwValue}
              onChange={(e) => onGwChange(Number(e.target.value))}
            >
              {gwPickerOptions.map((g) => (
                <option key={g} value={g}>
                  {gameWeekSelectLabel(g)}
                </option>
              ))}
            </select>
          ) : null}
          <div
            className="waiver-summary-share__layout-toggle"
            role="group"
            aria-label="Waiver summary layout"
          >
            <button
              type="button"
              className={
                layoutMode === 'league'
                  ? 'waiver-summary-share__layout-btn waiver-summary-share__layout-btn--active'
                  : 'waiver-summary-share__layout-btn'
              }
              aria-pressed={layoutMode === 'league'}
              onClick={() => setLayoutMode('league')}
            >
              By order
            </button>
            <button
              type="button"
              className={
                layoutMode === 'team'
                  ? 'waiver-summary-share__layout-btn waiver-summary-share__layout-btn--active'
                  : 'waiver-summary-share__layout-btn'
              }
              aria-pressed={layoutMode === 'team'}
              onClick={() => setLayoutMode('team')}
            >
              By team
            </button>
          </div>
        </div>
        <div className="waiver-summary-share__toolbar-actions">
          <button
            type="button"
            className="waiver-summary-share__copy"
            onClick={onCopy}
            disabled={!shareText}
          >
            {copied ? 'Copied' : 'Copy for sharing'}
          </button>
        </div>
      </div>

      <div
        className="waiver-summary-share__shot waiver-summary-share__shot--compact"
        aria-label="Waiver summary for sharing"
      >
        <div className="waiver-summary-share__shot-head">
          <span className="waiver-summary-share__shot-abbr">{leagueTitleAbbr}</span>
          <span className="waiver-summary-share__shot-gw tabular">GW {gw}</span>
        </div>

        {layoutMode === 'league' ? (
          <ul className="waiver-summary-share__compact-list">
            {flatRows.map((r) => (
              <CompactMoveLine
                key={r.transactionId}
                r={r}
                showTeamColumn
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            ))}
          </ul>
        ) : (
          <div className="waiver-summary-share__team-stack">
            {teamGroups.map((g) => (
              <section key={g.entry} className="waiver-summary-share__team-section">
                <div className="waiver-summary-share__team-section-head">
                  <span className="waiver-summary-share__team-section-name">
                    {teamFirstToken(g.teamName)}
                  </span>
                  <TeamAvatar
                    entryId={g.leagueEntryId}
                    name={g.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </div>
                <ul className="waiver-summary-share__compact-list waiver-summary-share__compact-list--nested">
                  {g.moves.map((r) => (
                    <CompactMoveLine
                      key={r.transactionId}
                      r={r}
                      showTeamColumn={false}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
