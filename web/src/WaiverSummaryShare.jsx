import { useCallback, useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar.jsx'
import { PlayerKit } from './PlayerKit.jsx'
import { gameWeekSelectLabel } from './gwLabel.js'
import { flattenWaiverGroups, sortMovesWaiverThenFa } from './waiverMovesSort.js'
import { CompactSelectPill } from './CompactSelectPill.jsx'
import { teamChipAbbr } from './liveScoresDerivations.js'
import './WaiversPanel.css'

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
 * @param {{ gw: number | null, flatRows: Array<object>, leagueTitleAbbr: string, leagueTitle: string }} args
 */
function buildWaiverShareText({ gw, flatRows, leagueTitleAbbr, leagueTitle }) {
  if (gw == null || !flatRows?.length) return ''
  const lines = []
  lines.push(`${leagueTitleAbbr} · GW ${gw}`)
  lines.push(leagueTitle)
  lines.push('')
  for (const r of flatRows) {
    lines.push(`${moveLineForCopy(r)}  |  ${teamChipAbbr(r.teamName)}`)
  }
  return lines.join('\n').trimEnd()
}

function shareCardDensity(rowCount) {
  if (rowCount > 16) return 'dense'
  if (rowCount > 8) return 'compact'
  return 'airy'
}

/** Draft waivers are same-position swaps — one GKP/DEF/MID/FWD label per row. */
function shareMovePos(row) {
  const raw = row?.pickedPos || row?.droppedPos
  return raw ? String(raw).toUpperCase() : ''
}

function SharePos({ pos }) {
  if (!pos) return <span className="waivers-share__pos" aria-hidden="true" />
  return (
    <span
      className={`waivers-share__pos waivers-pos-chip waivers-pos-chip--${pos}`}
      title={pos}
      aria-label={pos}
    >
      {pos}
    </span>
  )
}

function SharePlayer({ badgeUrl, teamShort, name, out = false }) {
  return (
    <span className={out ? 'waivers-share__player waivers-share__player--out' : 'waivers-share__player'}>
      <span className={out ? 'waivers-share__crest waivers-share__crest--out' : 'waivers-share__crest'}>
        <PlayerKit badgeUrl={badgeUrl} teamShort={teamShort} />
      </span>
      <span className={out ? 'waivers-share__name waivers-share__name--out' : 'waivers-share__name'}>
        {name ?? '—'}
      </span>
    </span>
  )
}

function ShareOwner({ row, teamLogoMap, kitIndexByEntry }) {
  const abbr = teamChipAbbr(row.teamName)
  return (
    <span className="waivers-share__owner" title={row.teamName}>
      <TeamAvatar
        entryId={row.leagueEntryId}
        name={row.teamName}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
      <span className="waivers-share__owner-abbr">{abbr}</span>
    </span>
  )
}

/**
 * Portrait, screenshot-friendly waiver card. Rows stack at a fixed compact
 * height (no flex-grow between rows) so a light week stays tight and
 * 15–20 picks still fit in one phone screenshot. Density scales type/crests
 * to row count. Real GW data: position · IN crest + name ← OUT crest +
 * name, league-wide waiver order (FA = none), manager fantasy crest +
 * 3-letter team code pinned right. Position is shown once — in and out
 * share it.
 */
function WaiverShareCard({
  gw,
  rows,
  leagueTitleAbbr,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const density = shareCardDensity(rows.length)
  return (
    <div className={'waivers-share waivers-share--' + density} aria-label="Waiver summary for sharing">
      <div className="waivers-share__head">
        <div className="waivers-share__brand">
          <span className="waivers-share__league">{leagueTitleAbbr}</span>
          <span className="waivers-share__title">Waivers</span>
        </div>
        <span className="waivers-share__gw tabular">GW {gw}</span>
      </div>
      <ol className="waivers-share__list">
        {rows.map((r) => {
          const isFa = r.transactionKind === 'f'
          const pos = shareMovePos(r)
          return (
            <li className="waivers-share__row" key={r.transactionId}>
              <span className="waivers-share__marker tabular">
                {isFa ? (
                  <span className="waivers-share__tag waivers-share__tag--fa">FA</span>
                ) : r.waiverProcessOrder != null ? (
                  r.waiverProcessOrder
                ) : (
                  ''
                )}
              </span>
              <SharePos pos={pos} />
              <SharePlayer
                badgeUrl={r.pickedBadgeUrl}
                teamShort={r.pickedTeamShort}
                name={r.pickedName}
              />
              <span className="waivers-share__arrow" aria-hidden="true">←</span>
              <SharePlayer
                badgeUrl={r.droppedBadgeUrl}
                teamShort={r.droppedTeamShort}
                name={r.droppedName}
                out
              />
              <ShareOwner
                row={r}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Shareable weekly waiver card — a portrait, one-screen, screenshot-friendly
 * render of a single GW's waivers built from real league data, with a GW picker
 * and copy-for-sharing action.
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
  showGwPicker = true,
}) {
  const [copied, setCopied] = useState(false)

  const flatRows = useMemo(() => {
    const f = flattenWaiverGroups(groups)
    return f.sort(sortMovesWaiverThenFa)
  }, [groups])

  const shareText = useMemo(
    () => buildWaiverShareText({ gw, flatRows, leagueTitleAbbr, leagueTitle }),
    [gw, flatRows, leagueTitleAbbr, leagueTitle],
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
        {showGwPicker && gwPickerOptions.length > 0 && gwValue != null && onGwChange ? (
          <div className="waiver-summary-share__toolbar-row waiver-summary-share__toolbar-row--primary">
            <CompactSelectPill
              className="waiver-summary-share__gw-select"
              label="GW"
              ariaLabel="Waivers game week"
              isActive={false}
              value={String(gwValue)}
              onChange={(next) => onGwChange(Number(next))}
              options={gwPickerOptions.map((g) => ({
                value: String(g),
                label: gameWeekSelectLabel(g),
              }))}
            />
          </div>
        ) : null}
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

      <WaiverShareCard
        gw={gw}
        rows={flatRows}
        leagueTitleAbbr={leagueTitleAbbr}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </div>
  )
}
