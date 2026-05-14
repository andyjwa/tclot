import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { buildH2hRivalsForTeam } from './h2hRivalsTable'

/**
 * @param {object} props
 * @param {object[]} props.matches
 * @param {{ id?: number, teamName?: string }[]} props.teamsForFormSelect — primary source for league entry ids + names
 * @param {{ league_entry?: number, teamName?: string }[]} props.tableRows — fallback names / ids
 * @param {object[]} props.leagueEntries
 * @param {number | null | undefined} props.activeFormEntry — league_entry id (same as Team form)
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 */
export function H2hRivalsSection({
  matches = [],
  teamsForFormSelect = [],
  tableRows = [],
  leagueEntries = [],
  activeFormEntry = null,
  teamLogoMap = {},
  kitIndexByEntry = {},
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

  const leagueTeamCount = teamsForFormSelect?.length ?? Object.keys(idToName).length

  const rivalRows = useMemo(
    () =>
      activeFormEntry != null && Number.isFinite(Number(activeFormEntry))
        ? buildH2hRivalsForTeam(matches, idToName, activeFormEntry)
        : [],
    [matches, idToName, activeFormEntry],
  )

  const teamName =
    activeFormEntry != null && idToName[Number(activeFormEntry)]
      ? idToName[Number(activeFormEntry)]
      : null

  if (leagueTeamCount < 2) return null

  return (
    <section className="tile tile--compact" aria-labelledby="h2h-rivals-heading">
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="h2h-rivals-heading" className="tile-title tile-title--sm">
          Head-to-head vs opponents
        </h2>
      </div>
      <p className="tile-hint muted tile-hint--tight">
        <strong>Standings &amp; Form</strong> only (on narrow screens the app opens Live first — switch
        tabs in the nav if needed). Finished H2Hs this season for the team selected in{' '}
        <strong>Team form</strong> above
        {teamName ? (
          <>
            {' '}
            (<span className="tabular">{teamName}</span>)
          </>
        ) : null}
        . Record is W–D–L; For / Faced are your FPL points and your opponents’, summed across meetings.
      </p>
      {activeFormEntry == null || !Number.isFinite(Number(activeFormEntry)) ? (
        <p className="muted muted--tight">Choose a team in Team form above.</p>
      ) : rivalRows.length === 0 ? (
        <p className="muted muted--tight">No league opponents in data.</p>
      ) : (
        <div className="table-scroll table-scroll--win-margin">
          <table className="win-margin-table h2h-rivals-table">
            <thead>
              <tr>
                <th scope="col" className="win-margin-table__team">
                  Opponent
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular"
                  title="Wins – draws – losses vs this opponent"
                >
                  Record
                </th>
                <th scope="col" className="win-margin-table__n tabular" title="Your FPL points total">
                  For
                </th>
                <th scope="col" className="win-margin-table__n tabular" title="Their FPL points total">
                  Faced
                </th>
                <th
                  scope="col"
                  className="win-margin-table__n tabular h2h-rivals-table__col--last"
                  title="Most recent finished meeting (your score first)"
                >
                  Last
                </th>
              </tr>
            </thead>
            <tbody>
              {rivalRows.map((r) => (
                <tr key={r.opponentId}>
                  <th scope="row" className="win-margin-table__team">
                    <span className="win-margin-table__team-inner">
                      <TeamAvatar
                        entryId={r.opponentId}
                        name={r.opponentName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <span className="win-margin-table__name">{r.opponentName}</span>
                    </span>
                  </th>
                  <td className="tabular win-margin-table__n">{r.record}</td>
                  <td className="tabular win-margin-table__n">{r.for}</td>
                  <td className="tabular win-margin-table__n">{r.against}</td>
                  <td className="tabular win-margin-table__n h2h-rivals-table__col--last h2h-rivals-table__last-cell">
                    {r.lastLabel}
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
