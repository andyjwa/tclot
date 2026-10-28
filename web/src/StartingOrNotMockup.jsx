import { useEffect, useRef, useState } from 'react'
import {
  ANNOUNCED,
  CLUBS,
  MANAGERS,
  SHEET_DAYS,
  buildSnapshot,
  clubName,
  managerById,
  sheetById,
} from './startingOrNotMockData.js'
import './StartingOrNotMockup.css'

/**
 * Local-only gallery at `?starting=1`.
 *
 * Three placements for a lineup-day snapshot: who is in the XI and who is
 * not, per fantasy team, limited to fixtures whose sheets are out and still
 * to play. The current sheet (the thing people screenshot) stays in place
 * in every option.
 */

const OPTIONS = [
  {
    id: 'lineups',
    kicker: 'A',
    label: 'On Lineups',
    place: 'Lives on the Lineups page, under the gameweek control. The two modes are Lineups and Starting. Lineups is the fixture list and the XI you screenshot today. Starting is the snapshot, with the team and fixture filters.',
  },
  {
    id: 'section',
    kicker: 'B',
    label: 'New tab',
    place: 'Lives as its own Starting tab on FPL Live, beside Scores and Lineups. The Lineups page stays as it is, so the sheet screenshot does not change. Everyone is a one-row scan; a team opens the two lists.',
  },
  {
    id: 'fixture',
    kicker: 'C',
    label: 'Inside a fixture',
    place: 'Lives on Scores, inside an open fixture, on the Lineups tab. The block covers that match only. It collapses, so the XI underneath can be screenshotted on its own. Fixture chips move between sheets that are already out.',
  },
]

function crestUrl(code) {
  const id = CLUBS[code]?.code
  return id ? `https://resources.premierleague.com/premierleague/badges/70/t${id}.png` : null
}

function Crest({ code, size = 18 }) {
  const url = crestUrl(code)
  return (
    <span className="son-crest" style={{ width: size, height: size }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : <span>{code}</span>}
    </span>
  )
}

function Avatar({ id, size = 26 }) {
  const m = managerById(id)
  if (!m) return null
  return (
    <span
      className="son-avatar"
      style={{
        width: size,
        height: size,
        color: m.color,
        background: `color-mix(in srgb, ${m.color} 16%, white)`,
        borderColor: `color-mix(in srgb, ${m.color} 45%, #ddd5b8)`,
      }}
      title={m.name}
    >
      {m.id}
    </span>
  )
}

function Pos({ pos }) {
  return <span className={`son-pos son-pos--${pos}`}>{pos}</span>
}

function roleTag(role) {
  if (role === 'bench') return 'Bench'
  if (role === 'nis') return 'Out'
  return null
}

function PlayerLine({ player }) {
  const tag = roleTag(player.role)
  return (
    <div className={'son-pl' + (player.role === 'xi' ? ' son-pl--in' : ' son-pl--out')}>
      <Crest code={player.club} size={16} />
      <span className="son-pl__name">{player.name}</span>
      <Pos pos={player.pos} />
      <span className="son-pl__meta">
        {tag ? <span className="son-pl__tag">{tag}</span> : null}
        <span>vs {player.opp}</span>
        <span className="son-pl__when">{player.when}</span>
      </span>
    </div>
  )
}

function WaitingLine({ player }) {
  return (
    <div className="son-pl son-pl--wait">
      <Crest code={player.club} size={16} />
      <span className="son-pl__name">{player.name}</span>
      <Pos pos={player.pos} />
      <span className="son-pl__meta">
        <span className="son-pl__tag">Waiting</span>
        <span>vs {player.versus}</span>
        <span className="son-pl__when">{player.when}</span>
      </span>
    </div>
  )
}

function Column({ title, tone, children, empty }) {
  return (
    <div className={`son-col son-col--${tone}`}>
      <div className="son-col__h">{title}</div>
      {empty ? <p className="son-col__empty">None</p> : children}
    </div>
  )
}

function ManagerCard({ group, mobile }) {
  const { manager, starting, notStarting, waiting } = group
  return (
    <article className="son-card">
      <header className="son-card__head">
        <Avatar id={manager.id} />
        <div className="son-card__id">
          <strong>{mobile ? manager.short : manager.name}</strong>
          <span>
            {starting.length} starting · {notStarting.length} not starting
          </span>
        </div>
      </header>
      <div className={'son-split' + (mobile ? ' is-narrow' : '')}>
        <Column title="Starting" tone="in" empty={!starting.length}>
          {starting.map((player) => (
            <PlayerLine key={`${player.fixtureId}-${player.name}`} player={player} />
          ))}
        </Column>
        <Column title="Not starting" tone="out" empty={!notStarting.length}>
          {notStarting.map((player) => (
            <PlayerLine key={`${player.fixtureId}-${player.name}`} player={player} />
          ))}
        </Column>
      </div>
      {waiting.length ? (
        <div className="son-wait">
          <div className="son-col__h">Still waiting on a sheet</div>
          {waiting.map((player) => (
            <WaitingLine key={player.name} player={player} />
          ))}
        </div>
      ) : null}
    </article>
  )
}

function TapeRow({ group, mobile }) {
  const { manager, starting, notStarting, waiting } = group
  return (
    <article className={'son-tape' + (mobile ? ' is-narrow' : '')}>
      <header className="son-tape__who">
        <Avatar id={manager.id} size={28} />
        <div>
          <strong>{mobile ? manager.short : manager.name}</strong>
          <span>
            {starting.length}–{notStarting.length}
          </span>
        </div>
      </header>
      <div className="son-tape__picks">
        <div className="son-tape__line">
          <span className="son-tape__k">In</span>
          {starting.length ? starting.map((player) => (
            <span className="son-pick son-pick--in" key={`${player.fixtureId}-${player.name}`}>
              <Crest code={player.club} size={14} />
              {player.name}
            </span>
          )) : <span className="son-tape__none">None</span>}
        </div>
        <div className="son-tape__line">
          <span className="son-tape__k son-tape__k--out">Out</span>
          {notStarting.length ? notStarting.map((player) => (
            <span className="son-pick son-pick--out" key={`${player.fixtureId}-${player.name}`}>
              <Crest code={player.club} size={14} />
              {player.name}
              <span className="son-pick__tag">{roleTag(player.role)}</span>
            </span>
          )) : <span className="son-tape__none">None</span>}
        </div>
        {waiting.length ? (
          <div className="son-tape__line">
            <span className="son-tape__k son-tape__k--wait">Wait</span>
            {waiting.map((player) => (
              <span className="son-pick son-pick--wait" key={player.name}>
                <Crest code={player.club} size={14} />
                {player.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function Status({ totals, fixtureId, teamId }) {
  const fixture = fixtureId ? ANNOUNCED.find((f) => f.id === fixtureId) : null
  const team = teamId ? managerById(teamId) : null
  const scope = fixture
    ? `${clubName(fixture.home)} v ${clubName(fixture.away)}`
    : 'Every sheet that is out'
  const who = team ? team.short : 'Every team'
  return (
    <div className="son-status">
      <strong>{who}</strong>
      <span>{scope}</span>
      <span>
        {totals.starting} starting · {totals.notStarting} not starting
        {totals.waiting ? ` · ${totals.waiting} waiting` : ''}
      </span>
    </div>
  )
}

function Empty({ teamId, fixtureId }) {
  const team = teamId ? managerById(teamId) : null
  const fixture = fixtureId ? ANNOUNCED.find((f) => f.id === fixtureId) : null
  const who = team ? team.name : 'This filter'
  const where = fixture ? `${clubName(fixture.home)} v ${clubName(fixture.away)}` : 'the sheets that are out'
  return (
    <p className="son-empty">
      {who} has no players in {where}.
    </p>
  )
}

function StartingBody({ variant, teamId, fixtureId, mobile }) {
  const { groups, totals } = buildSnapshot(teamId, fixtureId)
  const tape = variant === 'tape' && !teamId
  return (
    <div className="son-body">
      <Status totals={totals} fixtureId={fixtureId} teamId={teamId} />
      {groups.length === 0 ? <Empty teamId={teamId} fixtureId={fixtureId} /> : null}
      {tape
        ? groups.map((group) => <TapeRow key={group.manager.id} group={group} mobile={mobile} />)
        : groups.map((group) => <ManagerCard key={group.manager.id} group={group} mobile={mobile} />)}
    </div>
  )
}

function CheckMenu({ label, value, options, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = options.find((opt) => opt.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={'son-dd' + (open ? ' is-open' : '') + (align === 'right' ? ' son-dd--right' : '')} ref={rootRef}>
      <button
        type="button"
        className={'son-dd__btn' + (open ? ' is-open' : '') + (selected?.marked ? ' is-set' : '')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? `${label}: ${selected.trigger}` : label}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="son-dd__label">{label}</span>
        <span className="son-dd__sep" aria-hidden>·</span>
        <span className="son-dd__value">{selected?.trigger}</span>
        <span className="son-dd__chev" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <ul className="son-dd__menu" role="listbox" aria-label={label}>
          {options.map((opt) => {
            const on = opt.value === value
            return (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? 'is-on' : ''}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <span className={'son-dd__tick' + (on ? ' is-on' : '')} aria-hidden="true">{on ? '✓' : ''}</span>
                  <span className="son-dd__opt">{opt.node}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function fixtureTrigger(fixture, mobile) {
  if (!fixture) return 'All out'
  const home = mobile ? fixture.home : clubName(fixture.home)
  const away = mobile ? fixture.away : clubName(fixture.away)
  return fixture.state === 'live' ? `${home} v ${away} ${fixture.minute}` : `${home} v ${away}`
}

function FixtureOptionLabel({ fixture }) {
  return (
    <span className="son-dd__fix">
      <Crest code={fixture.home} size={16} />
      <span>{clubName(fixture.home)}</span>
      <span className="son-dd__vs">v</span>
      <Crest code={fixture.away} size={16} />
      <span>{clubName(fixture.away)}</span>
      {fixture.state === 'live' ? <span className="son-dd__live">{fixture.minute}</span> : null}
    </span>
  )
}

function TeamFilters({ teamId, onTeam, mobile }) {
  const options = [
    { value: null, trigger: 'Everyone', node: 'Everyone', marked: false },
    ...MANAGERS.map((m) => ({
      value: m.id,
      trigger: mobile ? m.id : m.short,
      marked: true,
      node: (
        <span className="son-dd__team">
          <i style={{ background: m.color }} aria-hidden="true" />
          {m.name}
        </span>
      ),
    })),
  ]
  return <CheckMenu label="Team" value={teamId} options={options} onChange={onTeam} />
}

function FixtureFilters({ fixtureId, onFixture, requiredId, mobile }) {
  const active = requiredId
    ? (fixtureId && ANNOUNCED.some((f) => f.id === fixtureId) ? fixtureId : requiredId)
    : fixtureId
  const options = [
    ...(requiredId ? [] : [{ value: null, trigger: 'All out', node: 'All out', marked: false }]),
    ...ANNOUNCED.map((f) => ({
      value: f.id,
      trigger: fixtureTrigger(f, mobile),
      marked: true,
      node: <FixtureOptionLabel fixture={f} />,
    })),
  ]
  return (
    <CheckMenu
      label="Fixture"
      value={active}
      options={options}
      onChange={onFixture}
      align={mobile ? 'right' : 'left'}
    />
  )
}

function GwNav() {
  return (
    <div className="son-gw" aria-hidden="true">
      <span>‹</span>
      <strong>GW 31</strong>
      <span>›</span>
    </div>
  )
}

function Subnav({ tabs, active }) {
  return (
    <div className="son-subnav" aria-label="FPL Live">
      {tabs.map((tab) => (
        <span key={tab} className={tab === active ? 'is-on' : ''}>
          {tab}
        </span>
      ))}
    </div>
  )
}

function AppBar({ mobile }) {
  return (
    <header className="son-bar">
      <span className="son-lion" aria-hidden="true">T</span>
      <strong>TCLOT</strong>
      {mobile ? null : <span className="son-bar__season">FPL Live · GW 31</span>}
    </header>
  )
}

function StateChip({ fixture }) {
  if (fixture.state === 'live') {
    return <span className="son-chip son-chip--live"><i />LIVE {fixture.minute}</span>
  }
  if (fixture.state === 'pre') return <span className="son-chip son-chip--pre">Lineups out</span>
  if (fixture.state === 'ft') return <span className="son-chip son-chip--ft">FT</span>
  return <span className="son-chip son-chip--ghost" />
}

function SheetCell({ player, club }) {
  if (!player) return <div className="son-sheetcell son-sheetcell--empty" />
  return (
    <div className={'son-sheetcell' + (player.owner ? ' is-owned' : '')}>
      <Crest code={club} size={14} />
      <span>{player.name}</span>
      {player.owner ? <Avatar id={player.owner} size={16} /> : <span />}
      <Pos pos={player.pos} />
    </div>
  )
}

function SheetExtras({ bench, out, club }) {
  const owned = (bench || []).filter((p) => p.owner)
  const other = (bench || []).filter((p) => !p.owner)
  const nis = (out || []).filter((p) => p.owner)
  return (
    <div className="son-sheet__extra">
      {owned.length ? (
        <>
          <div className="son-sheet__h">Bench</div>
          {owned.map((player) => <SheetCell key={player.name} player={player} club={club} />)}
        </>
      ) : null}
      {other.length ? (
        <p className="son-sheet__others">
          <Crest code={club} size={12} />
          {other.map((player) => player.name).join(' · ')}
        </p>
      ) : null}
      {nis.length ? (
        <p className="son-sheet__nis">
          <span>Not in squad</span>
          {nis.map((player) => player.name).join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

function PairedSheet({ fixture }) {
  const n = Math.max(fixture.xi.home.length, fixture.xi.away.length)
  return (
    <div className="son-paired">
      <div className="son-paired__heads">
        <span><Crest code={fixture.home} size={18} /> {clubName(fixture.home)}</span>
        <span>{clubName(fixture.away)} <Crest code={fixture.away} size={18} /></span>
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div className="son-paired__row" key={i}>
          <SheetCell player={fixture.xi.home[i]} club={fixture.home} />
          <SheetCell player={fixture.xi.away[i]} club={fixture.away} />
        </div>
      ))}
      <div className="son-paired__row son-paired__row--extra">
        <SheetExtras bench={fixture.bench.home} out={fixture.out.home} club={fixture.home} />
        <SheetExtras bench={fixture.bench.away} out={fixture.out.away} club={fixture.away} />
      </div>
    </div>
  )
}

function SingleSheet({ fixture }) {
  const [side, setSide] = useState('home')
  const club = fixture[side]
  return (
    <div className="son-oneside">
      <div className="son-oneside__toggle" role="tablist">
        {['home', 'away'].map((key) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={side === key}
            className={side === key ? 'is-on' : ''}
            onClick={() => setSide(key)}
          >
            <Crest code={fixture[key]} size={16} />
            {clubName(fixture[key])}
          </button>
        ))}
      </div>
      {fixture.xi[side].map((player) => (
        <SheetCell key={player.name} player={player} club={club} />
      ))}
      <SheetExtras bench={fixture.bench[side]} out={fixture.out[side]} club={club} />
    </div>
  )
}

function FixtureButton({ fixture, mobile, open, onToggle }) {
  const center = fixture.state === 'live' || fixture.state === 'ft' ? fixture.score : 'vs'
  return (
    <button type="button" className={'son-fx' + (open ? ' is-open' : '')} aria-expanded={open} onClick={onToggle}>
      <StateChip fixture={fixture} />
      <span className="son-fx__home">
        {mobile ? fixture.home : clubName(fixture.home)}
        <Crest code={fixture.home} size={16} />
      </span>
      <span className={'son-fx__mid' + (center === 'vs' ? ' is-vs' : '')}>{center}</span>
      <span className="son-fx__away">
        <Crest code={fixture.away} size={16} />
        {mobile ? fixture.away : clubName(fixture.away)}
      </span>
      <span className="son-fx__ko">{fixture.state === 'live' || fixture.state === 'ft' ? '' : fixture.ko}</span>
    </button>
  )
}

function SheetList({ mobile, openId, onToggle }) {
  const live = SHEET_DAYS.flatMap((day) => day.ids.map(sheetById).filter((f) => f?.state === 'live'))
  return (
    <div className="son-sheetlist">
      <p className="son-caption">Lineups is the fixture list and the XI. Open a row to screenshot it.</p>
      {live.length ? (
        <section>
          <div className="son-day son-day--live">Live now</div>
          {live.map((fixture) => (
            <div key={fixture.id}>
              <FixtureButton fixture={fixture} mobile={mobile} open={openId === fixture.id} onToggle={() => onToggle(fixture.id)} />
              {openId === fixture.id ? (mobile ? <SingleSheet fixture={fixture} /> : <PairedSheet fixture={fixture} />) : null}
            </div>
          ))}
        </section>
      ) : null}
      {SHEET_DAYS.map((day) => {
        const fixtures = day.ids.map(sheetById).filter((f) => f && f.state !== 'live')
        return (
          <section key={day.label}>
            <div className="son-day">{day.label}</div>
            {fixtures.map((fixture) => (
              <div key={fixture.id}>
                <FixtureButton
                  fixture={fixture}
                  mobile={mobile}
                  open={openId === fixture.id}
                  onToggle={() => onToggle(fixture.id)}
                />
                {openId === fixture.id && fixture.xi ? (
                  mobile ? <SingleSheet fixture={fixture} /> : <PairedSheet fixture={fixture} />
                ) : null}
                {openId === fixture.id && !fixture.xi ? (
                  <p className="son-empty">Lineups land here about 75 minutes before kickoff.</p>
                ) : null}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function LineupsOption({ mobile, teamId, fixtureId, onTeam, onFixture, mode, onMode, openId, onToggle }) {
  return (
    <>
      <Subnav tabs={['Scores', 'Lineups']} active="Lineups" />
      <GwNav />
      <div className="son-modes" role="tablist" aria-label="Lineups or Starting">
        <button type="button" role="tab" aria-selected={mode === 'lineups'} className={mode === 'lineups' ? 'is-on' : ''} onClick={() => onMode('lineups')}>
          Lineups
        </button>
        <button type="button" role="tab" aria-selected={mode === 'starting'} className={mode === 'starting' ? 'is-on' : ''} onClick={() => onMode('starting')}>
          Starting
        </button>
      </div>
      {mode === 'lineups' ? (
        <SheetList mobile={mobile} openId={openId} onToggle={onToggle} />
      ) : (
        <>
          <div className="son-filters">
            <TeamFilters teamId={teamId} onTeam={onTeam} mobile={mobile} />
            <FixtureFilters fixtureId={fixtureId} onFixture={onFixture} mobile={mobile} />
          </div>
          <StartingBody variant="cards" teamId={teamId} fixtureId={fixtureId} mobile={mobile} />
        </>
      )}
    </>
  )
}

function SectionOption({ mobile, teamId, fixtureId, onTeam, onFixture }) {
  return (
    <>
      <Subnav tabs={['Scores', 'Lineups', 'Starting']} active="Starting" />
      <GwNav />
      <div className="son-filters">
        <TeamFilters teamId={teamId} onTeam={onTeam} mobile={mobile} />
        <FixtureFilters fixtureId={fixtureId} onFixture={onFixture} mobile={mobile} />
      </div>
      <StartingBody variant="tape" teamId={teamId} fixtureId={fixtureId} mobile={mobile} />
    </>
  )
}

function FixtureOption({ mobile, teamId, fixtureId, onTeam, onFixture, leagueOpen, onLeague }) {
  const activeId = fixtureId && ANNOUNCED.some((f) => f.id === fixtureId) ? fixtureId : 'ars-liv'
  const fixture = ANNOUNCED.find((f) => f.id === activeId)
  const { totals } = buildSnapshot(teamId, activeId)
  return (
    <>
      <Subnav tabs={['Scores', 'Lineups']} active="Scores" />
      <GwNav />
      <div className="son-filters">
        <FixtureFilters fixtureId={activeId} onFixture={onFixture} requiredId="ars-liv" mobile={mobile} />
      </div>
      <div className="son-match">
        <StateChip fixture={fixture} />
        <span className="son-match__teams">
          <Crest code={fixture.home} size={22} />
          <strong>{fixture.state === 'live' ? fixture.score : 'vs'}</strong>
          <Crest code={fixture.away} size={22} />
        </span>
        <span>{clubName(fixture.home)} v {clubName(fixture.away)}</span>
      </div>
      <div className="son-matchtabs" aria-hidden="true">
        <span>Match</span>
        <span className="is-on">Lineups</span>
        <span>Stats</span>
        <span>Odds</span>
        <span>Table</span>
      </div>
      <section className={'son-league' + (leagueOpen ? ' is-open' : '')}>
        <button type="button" className="son-league__toggle" aria-expanded={leagueOpen} onClick={onLeague}>
          <span>League snapshot</span>
          <span>{totals.starting} in · {totals.notStarting} out</span>
          <span aria-hidden="true">{leagueOpen ? '▾' : '▸'}</span>
        </button>
        {leagueOpen ? (
          <>
            <div className="son-filters">
              <TeamFilters teamId={teamId} onTeam={onTeam} mobile={mobile} />
            </div>
            <StartingBody variant="cards" teamId={teamId} fixtureId={activeId} mobile={mobile} />
          </>
        ) : null}
      </section>
      <p className="son-caption">The XI below is the current lineup sheet. Collapse the snapshot to screenshot it on its own.</p>
      {mobile ? <SingleSheet fixture={fixture} /> : <PairedSheet fixture={fixture} />}
    </>
  )
}

function Screen({ option, mobile, filters }) {
  return (
    <div className={'son-app' + (mobile ? ' is-narrow' : '')}>
      <AppBar mobile={mobile} />
      {option === 'lineups' ? (
        <LineupsOption
          mobile={mobile}
          teamId={filters.teamId}
          fixtureId={filters.fixtureId}
          onTeam={filters.onTeam}
          onFixture={filters.onFixture}
          mode={filters.mode}
          onMode={filters.onMode}
          openId={filters.openId}
          onToggle={filters.onToggle}
        />
      ) : null}
      {option === 'section' ? (
        <SectionOption
          mobile={mobile}
          teamId={filters.teamId}
          fixtureId={filters.fixtureId}
          onTeam={filters.onTeam}
          onFixture={filters.onFixture}
        />
      ) : null}
      {option === 'fixture' ? (
        <FixtureOption
          mobile={mobile}
          teamId={filters.teamId}
          fixtureId={filters.fixtureId}
          onTeam={filters.onTeam}
          onFixture={filters.onFixture}
          leagueOpen={filters.leagueOpen}
          onLeague={filters.onLeague}
        />
      ) : null}
    </div>
  )
}

export function StartingOrNotMockup() {
  const [option, setOption] = useState('lineups')
  const [teamId, setTeamId] = useState(null)
  const [fixtureId, setFixtureId] = useState(null)
  const [mode, setMode] = useState('starting')
  const [openId, setOpenId] = useState('ars-liv')
  const [leagueOpen, setLeagueOpen] = useState(true)
  const current = OPTIONS.find((o) => o.id === option) || OPTIONS[0]
  const filters = {
    teamId,
    fixtureId,
    onTeam: setTeamId,
    onFixture: setFixtureId,
    mode,
    onMode: setMode,
    openId,
    onToggle: (id) => setOpenId((prev) => (prev === id ? null : id)),
    leagueOpen,
    onLeague: () => setLeagueOpen((open) => !open),
  }

  return (
    <main className="son">
      <header className="son-top">
        <div>
          <span className="son-kicker">TCLOT · lineup day</span>
          <h1>Starting or not</h1>
          <p>
            On the Lineups page, the two modes are Lineups and Starting. Lineups is the fixture list and the XI.
            Starting is who is in and who is out, for each fantasy team, from fixtures whose lineups are out and still to play.
            Filter by a team, by a fixture between two clubs, or both.
            Sample Saturday in GW 31: Newcastle v Brighton is live, Arsenal v Liverpool kicks off at 5:30.
          </p>
        </div>
        <a href="?">Exit mockup</a>
      </header>

      <section className="son-picker" aria-label="Design options">
        {OPTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === option ? 'is-on' : ''}
            onClick={() => setOption(item.id)}
          >
            <span>{item.kicker}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </section>

      <section className="son-place">
        <span>{current.kicker} · where it lives</span>
        <p>{current.place}</p>
      </section>

      <section className="son-devices">
        <div className="son-device">
          <div className="son-device__bar"><span>Desktop</span><b>{current.label}</b></div>
          <div className="son-device__screen">
            <Screen option={option} mobile={false} filters={filters} />
          </div>
        </div>
        <div className="son-device son-device--phone">
          <div className="son-device__bar"><span>Mobile · 390</span><b>{current.label}</b></div>
          <div className="son-device__screen">
            <Screen option={option} mobile filters={filters} />
          </div>
        </div>
      </section>

      <footer className="son-foot">
        Local preview at <code>?starting=1</code>. Sample names only. The sheet in each option is the current lineup XI, owner badge and all.
      </footer>
    </main>
  )
}
