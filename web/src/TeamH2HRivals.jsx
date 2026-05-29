import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { buildH2hRivalsForTeam } from './h2hRivalsTable'
import { CompactSelectPill } from './CompactSelectPill.jsx'

function firstWord(name) {
  if (typeof name !== 'string') return ''
  const t = name.trim()
  if (!t) return ''
  return t.split(/\s+/)[0]
}

/**
 * Per-opponent head-to-head table for one team, with a team picker dropdown.
 * Columns: VS · P · W · D · L · PF · PA. Standings tab → Stats sub-tab → Section 4.
 *
 * @param {object} props
 * @param {object[]} props.matches Raw H2H matches from `useLeagueData`.
 * @param {{ id: number, teamName: string }[]} props.teamsForFormSelect Sorted team list (from `useLeagueData`).
 * @param {{ league_entry?: number, teamName?: string }[]} props.tableRows Standings rows (for fallback names).
 * @param {object[]} props.leagueEntries Raw league members.
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 * @param {number | null} props.activeTeamId league_entry id of the picked team.
 * @param {(id: number | null) => void} props.onTeamChange Picker change handler.
 */
export function TeamH2HRivals({
  matches = [],
  teamsForFormSelect = [],
  tableRows = [],
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  activeTeamId = null,
  onTeamChange,
}) {
  const idToName = useMemo(() => {
    const m = Object.create(null)
    for (const t of teamsForFormSelect || []) {
      const id = Number(t?.id)
      if (!Number.isFinite(id)) continue
      const name = t.teamName?.trim()
      m[id] = name || `Team ${id}`
    }
    for (const r of tableRows || []) {
      const id = Number(r?.league_entry)
      if (!Number.isFinite(id)) continue
      const name = r.teamName?.trim()
      if (!m[id]) m[id] = name || `Team ${id}`
    }
    for (const e of leagueEntries || []) {
      if (e?.id == null) continue
      const id = Number(e.id)
      if (!Number.isFinite(id)) continue
      const name = e.entry_name?.trim()
      if (!m[id]) m[id] = name || `Team ${id}`
      else if (name) m[id] = name
    }
    return m
  }, [teamsForFormSelect, tableRows, leagueEntries])

  const rivalRows = useMemo(
    () =>
      activeTeamId != null && Number.isFinite(Number(activeTeamId))
        ? buildH2hRivalsForTeam(matches, idToName, activeTeamId)
        : [],
    [matches, idToName, activeTeamId],
  )

  const showH2hBlock = (teamsForFormSelect?.length ?? 0) >= 2

  if (!showH2hBlock) return null

  return (
    <section
      className="standings-h2h-rivals"
      aria-labelledby="standings-h2h-rivals-heading"
    >
      <h3
        id="standings-h2h-rivals-heading"
        className="standings-stats-eyebrow"
      >
        Head-to-Head Rivals
      </h3>

      <div className="standings-h2h-rivals__picker-row">
        <div className="standings-h2h-rivals__picker">
          <CompactSelectPill
            label="Team"
            ariaLabel="Team for head-to-head rivals table"
            value={activeTeamId == null ? '' : String(activeTeamId)}
            onChange={(next) => onTeamChange(next === '' ? null : Number(next))}
            isActive={activeTeamId != null}
            options={teamsForFormSelect.map((t) => ({
              value: String(t.id),
              label: t.teamName,
            }))}
          />
        </div>
      </div>

      {activeTeamId == null || !Number.isFinite(Number(activeTeamId)) ? (
        <p className="muted muted--tight">Choose a team in the dropdown above.</p>
      ) : rivalRows.length === 0 ? (
        <p className="muted muted--tight">No league opponents in data.</p>
      ) : (
        <div className="table-scroll table-scroll--win-margin">
          <table className="win-margin-table standings-h2h-rivals__table">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="win-margin-table__team standings-h2h-rivals__col-vs"
                >
                  VS
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-p"
                  title="Played"
                >
                  P
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-w"
                  title="Won"
                >
                  W
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-d"
                  title="Drawn"
                >
                  D
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-l"
                  title="Lost"
                >
                  L
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-pf"
                  title="Points for"
                >
                  PF
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular standings-h2h-rivals__col-pa"
                  title="Points against"
                >
                  PA
                </th>
              </tr>
            </thead>
            <tbody>
              {rivalRows.map((r) => (
                <tr key={r.opponentId}>
                  <th
                    scope="row"
                    className="win-margin-table__team standings-h2h-rivals__col-vs"
                  >
                    <span className="win-margin-table__team-inner">
                      <TeamAvatar
                        entryId={r.opponentId}
                        name={r.opponentName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <span
                        className="win-margin-table__name standings-h2h-rivals__name"
                        title={r.opponentName}
                      >
                        <span className="standings-h2h-rivals__name-full">
                          {r.opponentName}
                        </span>
                        <span className="standings-h2h-rivals__name-short">
                          {firstWord(r.opponentName)}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="tabular win-margin-table__n">{r.p}</td>
                  <td className="tabular win-margin-table__n">{r.w}</td>
                  <td className="tabular win-margin-table__n">{r.d}</td>
                  <td className="tabular win-margin-table__n">{r.l}</td>
                  <td className="tabular win-margin-table__n">
                    {typeof r.for === 'number' ? r.for : '—'}
                  </td>
                  <td className="tabular win-margin-table__n">
                    {typeof r.against === 'number' ? r.against : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
