import { Fragment, useState } from 'react'
import './TeamJourneysMobileMockup.css'
import {
  HALL_SEASON_FINAL_TABLES,
  hallManagerDisplayKey,
} from './hallManagerHistory.js'

/**
 * Local-only Team Journeys mobile layout gallery (`?tjourney=1`).
 *
 * Production History › Team Journeys currently stacks a Titles/Titan/Minnow
 * strip under each manager card — readable, but tall and gappy on phones.
 * These options try slimmer rows and a league-table reading before we lock one.
 */

const MGR_META = {
  Andy: { fullName: 'Andy Ward', initials: 'AW', color: '#3b82f6' },
  David: { fullName: 'David Higman', initials: 'DH', color: '#8b5cf6' },
  Eddy: { fullName: 'Eddy Webster', initials: 'EW', color: '#f59e0b' },
  Jon: { fullName: 'Jon Ward', initials: 'JW', color: '#10b981' },
  Luke: { fullName: 'Luke Butcher', initials: 'LB', color: '#ef4444' },
  Mike: { fullName: 'Mike Sutton', initials: 'MS', color: '#06b6d4' },
  'Nick G': { fullName: 'Nick Goodacre', initials: 'NG', color: '#ec4899' },
  'Nick M': { fullName: 'Nick Mottershead', initials: 'NM', color: '#a855f7' },
}

const LIVE_2526 = [
  { manager: 'Luke', team: 'Seoul Club 7', rank: 1 },
  { manager: 'David', team: 'Crouch End Oashisu', rank: 2 },
  { manager: 'Andy', team: 'Toronto Oizo', rank: 3 },
  { manager: 'Eddy', team: 'Brampton II Men', rank: 4 },
  { manager: 'Nick', team: 'Hanson of York AFC', rank: 5 },
  { manager: 'Nick', team: 'Hackney Meat Loaf', rank: 6 },
  { manager: 'Mike', team: 'Clapton Cornershop', rank: 7 },
  { manager: 'Jon', team: 'Morpeth Jamiroquai', rank: 8 },
]

function shortenSeason(season) {
  const m = /^(\d{2})(\d{2})-(\d{2})$/.exec(String(season))
  return m ? `${m[2]}/${m[3]}` : String(season)
}

function buildRows() {
  const seasonDefs = [
    ...HALL_SEASON_FINAL_TABLES.map(({ season, rows }) => ({
      season: shortenSeason(season),
      rows,
    })),
    { season: '25/26', rows: LIVE_2526 },
  ]
  const byKey = new Map()
  for (const { season, rows } of seasonDefs) {
    for (const r of rows) {
      const key = hallManagerDisplayKey(r.team, r.manager)
      if (!byKey.has(key)) {
        byKey.set(key, { key, seasons: [], titles: 0, titan: 0, minnow: 0 })
      }
      const a = byKey.get(key)
      const rank = Number(r.rank) || 0
      a.seasons.push({ season, team: r.team, rank })
      if (rank === 1) a.titles += 1
      if (rank >= 1 && rank <= 4) a.titan += 1
      if (rank >= 5 && rank <= 8) a.minnow += 1
    }
  }
  return [...byKey.values()]
    .map((r) => ({ ...r, meta: MGR_META[r.key] ?? { fullName: r.key, initials: '??', color: '#666' } }))
    .sort((a, b) => b.titles - a.titles || b.titan - a.titan || a.key.localeCompare(b.key))
}

const ROWS = buildRows()

function Phone({ label, note, children }) {
  return (
    <figure className="tjm-phone">
      <figcaption className="tjm-phone__cap">
        <strong>{label}</strong>
        {note ? <span>{note}</span> : null}
      </figcaption>
      <div className="tjm-phone__bezel">
        <div className="tjm-phone__screen">{children}</div>
      </div>
    </figure>
  )
}

function TitlesPill({ n }) {
  return (
    <span className="tjm-pill is-pos-1" aria-label={`${n} titles`}>
      {n}
    </span>
  )
}

function JourneyList({ seasons }) {
  return (
    <ul className="tjm-journey">
      {seasons.map((s) => (
        <li key={s.season} className={'tjm-journey__row is-pos-' + s.rank}>
          <span className="tjm-journey__season">{s.season}</span>
          <span className="tjm-journey__team">{s.team}</span>
          <span className={'tjm-pill tjm-pill--sm is-pos-' + s.rank}>{s.rank}</span>
        </li>
      ))}
    </ul>
  )
}

/** A · Shipped baseline — card + stats strip (tall / gappy). */
function OptionShipped() {
  const [open, setOpen] = useState(ROWS[0].key)
  return (
    <div className="tjm-opt tjm-opt--shipped">
      <div className="tjm-opt__head">Team Journeys</div>
      <ul className="tjm-shipped">
        {ROWS.map((row) => {
          const isOpen = open === row.key
          return (
            <li key={row.key} className="tjm-shipped__item">
              <button
                type="button"
                className={'tjm-shipped__toggle' + (isOpen ? ' is-open' : '')}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : row.key)}
              >
                <span className="tjm-shipped__name">{row.meta.fullName}</span>
                <span className="tjm-chev" aria-hidden>
                  ›
                </span>
              </button>
              <div className="tjm-cols">
                <span className="tjm-cols__h">Titles</span>
                <span className="tjm-cols__h">Titan</span>
                <span className="tjm-cols__h">Minnow</span>
                <span className="tjm-cols__n">
                  <TitlesPill n={row.titles} />
                </span>
                <span className="tjm-cols__n">{row.titan}</span>
                <span className="tjm-cols__n">{row.minnow}</span>
              </div>
              {isOpen ? <JourneyList seasons={row.seasons} /> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** B · Slim flush list — one compact row, hairlines, no card gaps. */
function OptionSlim() {
  const [open, setOpen] = useState(ROWS[0].key)
  return (
    <div className="tjm-opt tjm-opt--slim">
      <div className="tjm-opt__head">Team Journeys</div>
      <div className="tjm-slim__cols-head" aria-hidden>
        <span />
        <span>Titles</span>
        <span>Titan</span>
        <span>Minnow</span>
        <span />
      </div>
      <ul className="tjm-slim">
        {ROWS.map((row, idx) => {
          const isOpen = open === row.key
          return (
            <li key={row.key} className={'tjm-slim__item' + (isOpen ? ' is-open' : '')}>
              <button
                type="button"
                className="tjm-slim__row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : row.key)}
              >
                <span className="tjm-slim__place">{idx + 1}</span>
                <span className="tjm-slim__name">{row.meta.fullName}</span>
                <span className="tjm-slim__titles">
                  <TitlesPill n={row.titles} />
                </span>
                <span className="tjm-slim__num tabular">{row.titan}</span>
                <span className="tjm-slim__num tabular">{row.minnow}</span>
                <span className="tjm-chev" aria-hidden>
                  ›
                </span>
              </button>
              {isOpen ? <JourneyList seasons={row.seasons} /> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** C · League table — standings-style table, expand under row. */
function OptionLeague() {
  const [open, setOpen] = useState(ROWS[0].key)
  return (
    <div className="tjm-opt tjm-opt--league">
      <div className="tjm-opt__head">Team Journeys</div>
      <table className="tjm-league">
        <thead>
          <tr>
            <th className="tjm-league__th-rank">#</th>
            <th className="tjm-league__th-mgr">Manager</th>
            <th className="tjm-league__th-num" title="Seasons finished 1st">
              Titles
            </th>
            <th className="tjm-league__th-num" title="Top-half finishes (1st–4th)">
              Titan
            </th>
            <th className="tjm-league__th-num" title="Bottom-half finishes (5th–8th)">
              Minnow
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, idx) => {
            const isOpen = open === row.key
            return (
              <Fragment key={row.key}>
                <tr
                  className={'tjm-league__tr' + (isOpen ? ' is-open' : '')}
                  onClick={() => setOpen(isOpen ? null : row.key)}
                >
                  <td className="tjm-league__td-rank tabular">{idx + 1}</td>
                  <td className="tjm-league__td-mgr">
                    <span
                      className="tjm-crest"
                      style={{ background: row.meta.color }}
                      aria-hidden
                    >
                      {row.meta.initials}
                    </span>
                    <span className="tjm-league__name">{row.meta.fullName}</span>
                  </td>
                  <td className="tjm-league__td-num">
                    <TitlesPill n={row.titles} />
                  </td>
                  <td className="tjm-league__td-num tabular">{row.titan}</td>
                  <td className="tjm-league__td-num tabular">{row.minnow}</td>
                </tr>
                {isOpen ? (
                  <tr className="tjm-league__tr-expand">
                    <td colSpan={5}>
                      <JourneyList seasons={row.seasons} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** D · Dense league — initials + short name, tighter cells, sticky head. */
function OptionDense() {
  const [open, setOpen] = useState(null)
  return (
    <div className="tjm-opt tjm-opt--dense">
      <div className="tjm-opt__head">Team Journeys</div>
      <div className="tjm-dense-scroll">
        <table className="tjm-dense">
          <thead>
            <tr>
              <th>#</th>
              <th>Mgr</th>
              <th title="Titles">Tit</th>
              <th title="Titan (1st–4th)">Ti</th>
              <th title="Minnow (5th–8th)">Mi</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => {
              const isOpen = open === row.key
              return (
                <Fragment key={row.key}>
                  <tr
                    className={isOpen ? 'is-open' : undefined}
                    onClick={() => setOpen(isOpen ? null : row.key)}
                  >
                    <td className="tabular">{idx + 1}</td>
                    <td>
                      <span className="tjm-dense__mgr">
                        <span
                          className="tjm-crest tjm-crest--sm"
                          style={{ background: row.meta.color }}
                          aria-hidden
                        >
                          {row.meta.initials}
                        </span>
                        {row.key}
                      </span>
                    </td>
                    <td>
                      <TitlesPill n={row.titles} />
                    </td>
                    <td className="tabular">{row.titan}</td>
                    <td className="tabular">{row.minnow}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="tjm-dense__expand">
                      <td colSpan={5}>
                        <JourneyList seasons={row.seasons} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const OPTIONS = [
  {
    id: 'a',
    label: 'A · Shipped',
    note: 'Card + stats strip under each name. Tall; 8px gaps.',
    View: OptionShipped,
  },
  {
    id: 'b',
    label: 'B · Slim flush',
    note: 'One compact row · Titles pill + Titan + Minnow inline · hairlines, no gaps.',
    View: OptionSlim,
  },
  {
    id: 'c',
    label: 'C · League table',
    note: 'Standings-style table. Shared header. Tap row → season journey.',
    View: OptionLeague,
  },
  {
    id: 'd',
    label: 'D · Dense league',
    note: 'Tighter cells, short mgr key, abbreviated headers.',
    View: OptionDense,
  },
]

export function TeamJourneysMobileMockup() {
  return (
    <div className="tjm">
      <header className="tjm__hero">
        <p className="tjm__eyebrow">Heritage · History · Team Journeys</p>
        <h1 className="tjm__title">Mobile layout options</h1>
        <p className="tjm__lede">
          Titles (gold pill) · Titan (top-4 count) · Minnow (bottom-4 count). Goal: slimmer
          rows, no gappy cards — does a league table read cleaner than stacked strips?
        </p>
        <p className="tjm__hint muted">
          Local only · open with <code>?tjourney=1</code>
        </p>
      </header>
      <div className="tjm__grid">
        {OPTIONS.map(({ id, label, note, View }) => (
          <Phone key={id} label={label} note={note}>
            <View />
          </Phone>
        ))}
      </div>
    </div>
  )
}
