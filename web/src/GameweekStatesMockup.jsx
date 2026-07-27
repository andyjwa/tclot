import { useState } from 'react'
import './GameweekStatesMockup.css'

const STATES = [
  {
    id: 'postseason',
    tab: 'Now',
    title: 'Season complete',
    gw: 38,
    kind: 'over',
    header: 'GW 38 complete',
    headerTail: 'Season 25/26 complete',
    mobileLabel: 'Scores',
    progress: '10 / 10',
    liveCount: 0,
    minute: null,
    nextGw: null,
  },
  {
    id: 'preseason',
    tab: 'Pre-season',
    title: 'Pre-season',
    gw: 1,
    kind: 'pre',
    header: 'Pre-season',
    headerTail: '26/27 season starts Aug 21',
    mobileLabel: '26/27',
    progress: '0 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 1,
  },
  {
    id: 'between',
    tab: 'Between GWs',
    title: 'Waivers in 5d 3h',
    gw: 29,
    kind: 'over',
    header: 'GW 28 complete',
    headerTail: 'Waivers in 5d 3h · Mar 14 at 13:30',
    mobileLabel: 'Scores',
    progress: '0 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 29,
  },
  {
    id: 'near',
    tab: 'Waivers passed',
    title: 'GW 29 starts in 23h 40m',
    gw: 29,
    kind: 'over',
    header: 'GW 28 complete',
    headerTail: 'GW 29 starts in 23h 40m · Mar 15 at 13:30',
    mobileLabel: 'Scores',
    progress: '0 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 29,
  },
  {
    id: 'deadline',
    tab: 'Deadline',
    title: 'GW live, no match started',
    gw: 29,
    kind: 'live',
    header: 'GW 29',
    headerTail: 'Live · 0 of 10 complete',
    mobileLabel: 'Live',
    progress: '0 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 30,
  },
  {
    id: 'matchlive',
    tab: 'Match live',
    title: 'Fixtures in play',
    gw: 29,
    kind: 'live',
    header: 'GW 29',
    headerTail: '2 fixtures live · 67′ · 4 of 10 complete',
    mobileLabel: 'Live',
    progress: '4 / 10',
    liveCount: 2,
    minute: 67,
    nextGw: 30,
  },
  {
    id: 'gap',
    tab: 'Fixture gap',
    title: 'Between match windows',
    gw: 29,
    kind: 'live',
    header: 'GW 29',
    headerTail: 'Live · 7 of 10 complete',
    mobileLabel: 'Live',
    progress: '7 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 30,
  },
  {
    id: 'allft',
    tab: 'All FT',
    title: 'All matches FT, GW not finalized',
    gw: 29,
    kind: 'live',
    header: 'GW 29',
    headerTail: 'Live · 10 of 10 complete',
    mobileLabel: 'Live',
    progress: '10 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 30,
  },
  {
    id: 'finalized',
    tab: 'Finalized',
    title: 'Waivers in 5d 2h',
    gw: 29,
    kind: 'over',
    header: 'GW 29 complete',
    headerTail: 'Waivers in 5d 2h · Mar 21 at 13:30',
    mobileLabel: 'Scores',
    progress: '10 / 10',
    liveCount: 0,
    minute: null,
    nextGw: 30,
  },
]

const PAGES = [
  ['standings', 'Standings'],
  ['scores', 'Scores'],
  ['lineups', 'Lineups'],
  ['players', 'Players'],
  ['moves', 'Moves'],
  ['other', 'Other pages'],
]

const TEAMS = [
  ['Hanson of York', 'HY', 68],
  ['Hackney Meat Loaf', 'HM', 64],
  ['Crouch End Oashisu', 'CE', 59],
  ['Seoul Club 7', 'SC', 55],
  ['Clapton Cornershop', 'CC', 51],
  ['Morpeth Jamiroquai', 'MJ', 48],
  ['Toronto Oizo', 'TO', 44],
  ['Brampton II Men', 'BR', 39],
]

function StateDot({ kind }) {
  return <span className={`gwsm-dot gwsm-dot--${kind}`} aria-hidden="true" />
}

function Header({ state, mobile = false }) {
  return (
    <header className={`gwsm-header${mobile ? ' gwsm-header--mobile' : ''}`}>
      <div className="gwsm-brandrow">
        <div className="gwsm-lion">T</div>
        <div className="gwsm-brandcopy">
          <strong>TCLOT</strong>
          <span>TRI-CONTINENTAL LEAGUE OF TITANS</span>
        </div>
        <div className="gwsm-season">2026/27</div>
        {!mobile ? (
          <div className="gwsm-crests">
            {TEAMS.map((t) => <span key={t[1]}>{t[1]}</span>)}
          </div>
        ) : null}
      </div>
      <div className={`gwsm-status gwsm-status--${state.kind}`}>
        {state.kind === 'live' ? <StateDot kind="live" /> : null}
        <strong>{state.header}</strong>
        <span className="gwsm-sep">·</span>
        <span>{state.headerTail}</span>
      </div>
    </header>
  )
}

function DesktopNav({ page, onPage }) {
  return (
    <nav className="gwsm-desktopnav">
      <button type="button">26/27</button>
      <button
        type="button"
        className={page === 'scores' || page === 'lineups' ? 'is-active' : ''}
        onClick={() => onPage('scores')}
      >
        <StateDot kind="desktop" /> FPL Live
      </button>
      <button type="button" className={page === 'standings' ? 'is-active' : ''} onClick={() => onPage('standings')}>Standings</button>
      <button type="button" className={page === 'moves' ? 'is-active' : ''} onClick={() => onPage('moves')}>Moves</button>
      <button type="button" className={page === 'players' ? 'is-active' : ''} onClick={() => onPage('players')}>Players</button>
      <button type="button" className={page === 'other' ? 'is-active' : ''} onClick={() => onPage('other')}>TCLOT Heritage</button>
      <button type="button" className="gwsm-settings">Settings</button>
    </nav>
  )
}

function MobileNav({ state, page, onPage }) {
  const isPre = state.kind === 'pre'
  return (
    <nav className={`gwsm-mobilenav gwsm-mobilenav--${state.kind}`}>
      <button type="button" className={page === 'standings' ? 'is-active' : ''} onClick={() => onPage('standings')}>
        <span className="gwsm-navico">▥</span><span>Table</span>
      </button>
      <button type="button" className={page === 'moves' ? 'is-active' : ''} onClick={() => onPage('moves')}>
        <span className="gwsm-navico">↔</span><span>Moves</span>
      </button>
      <button
        type="button"
        className={`gwsm-mobilehero${page === 'scores' ? ' is-active' : ''}`}
        onClick={() => onPage(isPre ? 'other' : 'scores')}
      >
        <span className="gwsm-mobilehero__circle">
          {isPre ? <span className="gwsm-film">▶</span> : <StateDot kind={state.kind} />}
        </span>
        <span>{state.mobileLabel}</span>
      </button>
      <button type="button" className={page === 'players' ? 'is-active' : ''} onClick={() => onPage('players')}>
        <span className="gwsm-navico">⇄</span><span>Players</span>
      </button>
      <button type="button" className={page === 'other' ? 'is-active' : ''} onClick={() => onPage('other')}>
        <span className="gwsm-navico">•••</span><span>More</span>
      </button>
    </nav>
  )
}

function MiniCrest({ text }) {
  return <span className="gwsm-minicrest">{text}</span>
}

function StandingsPage({ state, mobile }) {
  const seasonEnded = state.id === 'postseason'
  const showNext = state.nextGw != null
  return (
    <div className="gwsm-page">
      <div className="gwsm-subnav"><b>Table</b><span>Schedule</span><span>Stats</span></div>
      <section className="gwsm-leader">
        <div className="gwsm-eyebrow">{seasonEnded ? 'CHAMPION' : 'TOP OF THE LEAGUE'}</div>
        <div className="gwsm-leaderrow">
          <MiniCrest text="HY" />
          <div><strong>Hanson of York AFC</strong><span>Nick H.</span></div>
          <div className="gwsm-leaderpts"><strong>82</strong><span>PTS</span></div>
        </div>
        <div className="gwsm-form"><i className="w" /><i className="w" /><i className="d" /><i className="w" /><i className="l" /><span>Played 38 · For 2,014</span></div>
      </section>
      <section className="gwsm-table">
        {TEAMS.slice(1, mobile ? 5 : 8).map((team, i) => (
          <div className="gwsm-tablerow" key={team[1]}>
            <span>{i + 2}</span><MiniCrest text={team[1]} /><strong>{team[0]}</strong>
            {!mobile ? <span>{38 - i}</span> : null}
            <span>{team[2]}</span>
            <span className="gwsm-rowform"><i className={i % 3 === 0 ? 'w' : 'l'} /><i className="d" /><i className="w" /></span>
            <span>{showNext ? <MiniCrest text={TEAMS[(i + 3) % 8][1]} /> : '—'}</span>
          </div>
        ))}
      </section>
      {showNext ? (
        <section className="gwsm-next">
          <div><span>NEXT GAMEWEEK</span><strong>GW {state.nextGw}</strong></div>
          <div className="gwsm-nextmatch"><MiniCrest text="HY" /><span>Hanson</span><b>v</b><span>Toronto</span><MiniCrest text="TO" /></div>
          <div className="gwsm-nextmatch"><MiniCrest text="HM" /><span>Hackney</span><b>v</b><span>Crouch</span><MiniCrest text="CE" /></div>
        </section>
      ) : null}
    </div>
  )
}

function scoreForState(state, a, b) {
  if (['preseason', 'between', 'near', 'deadline'].includes(state.id)) return ['—', '—']
  if (state.id === 'matchlive') return [a, b]
  return [a + 8, b + 6]
}

function ScoresPage({ state, mobile }) {
  const fixtures = [
    ['HY', 'Hanson', 44, 39, 'TO', 'Toronto'],
    ['HM', 'Hackney', 37, 48, 'CE', 'Crouch'],
    ['SC', 'Seoul', 51, 50, 'MJ', 'Morpeth'],
    ['CC', 'Clapton', 42, 31, 'BR', 'Brampton'],
  ]
  const active = state.id === 'matchlive'
  const frozen = ['postseason', 'between', 'near', 'finalized'].includes(state.id)
  const remaining = ['deadline', 'matchlive', 'gap'].includes(state.id)
  return (
    <div className="gwsm-page gwsm-livepage">
      <div className="gwsm-subnav"><b>Scores</b><span>Lineups</span></div>
      <div className="gwsm-gwnav"><button>‹</button><strong>Game Week {state.gw}</strong><button>›</button></div>
      <section className={`gwsm-fixtures${active ? ' is-live' : ''}`}>
        <div className="gwsm-fixturemeta">
          <span>{active ? <><StateDot kind="live" /> LIVE NOW</> : state.title.toUpperCase()}</span>
          <strong>{state.progress} done</strong>
        </div>
        {fixtures.map((fx, i) => {
          const score = scoreForState(state, fx[2], fx[3])
          return (
            <div className="gwsm-fixturerow" key={fx[0]}>
              <MiniCrest text={fx[0]} /><span>{fx[1]}</span>
              <strong>{score[0]} <small>–</small> {score[1]}</strong>
              <span>{fx[5]}</span><MiniCrest text={fx[4]} />
              {!mobile ? <span className="gwsm-remaining">{remaining ? `(${Math.max(0, 5 - i)})` : '●'}</span> : null}
            </div>
          )
        })}
      </section>
      <section className="gwsm-livetable">
        <div className="gwsm-cardtitle">{frozen ? 'FINAL TABLE' : 'LIVE TABLE'}</div>
        {TEAMS.slice(0, mobile ? 5 : 8).map((team, i) => (
          <div className="gwsm-live-row" key={team[1]}>
            <span>{i + 1}</span><MiniCrest text={team[1]} /><strong>{team[0]}</strong>
            <span>{2014 - i * 43}</span><b>{82 - i * 4}</b>
            <i className={frozen ? (i % 3 === 0 ? 'w' : 'l') : active ? (i % 2 ? 'l pulse' : 'w pulse') : 'none'} />
          </div>
        ))}
      </section>
      {remaining ? (
        <section className="gwsm-playersleft">
          <strong>Players remaining</strong>
          <span>Salah (MUN) · Palmer (ARS) · Isak (LEE) · +8</span>
        </section>
      ) : null}
    </div>
  )
}

function fixtureStage(state, index) {
  if (state.id === 'matchlive' && index < 2) return 'LIVE 67′'
  if (['postseason', 'allft', 'finalized'].includes(state.id)) return 'FT'
  if (state.id === 'gap' && index < 3) return 'FT'
  if (['near', 'deadline'].includes(state.id) && index === 0) return 'LINEUPS'
  return '16:30'
}

function LineupsPage({ state, mobile }) {
  const fixtures = [
    ['ARS', 'Arsenal', '2', '1', 'CHE', 'Chelsea'],
    ['LIV', 'Liverpool', '1', '1', 'MCI', 'Man City'],
    ['NEW', 'Newcastle', '0', '2', 'TOT', 'Spurs'],
    ['BHA', 'Brighton', 'vs', '', 'EVE', 'Everton'],
  ]
  const hasLive = state.id === 'matchlive'
  return (
    <div className="gwsm-page">
      <div className="gwsm-subnav"><span>Scores</span><b>Lineups</b></div>
      <div className="gwsm-gwnav"><button>‹</button><strong>Game Week {state.gw}</strong><button>›</button></div>
      {hasLive ? <div className="gwsm-livenow"><StateDot kind="live" /><b>Live now</b><span>2</span></div> : null}
      <section className="gwsm-lineuplist">
        {fixtures.map((fx, i) => {
          const stage = fixtureStage(state, i)
          const showScore = stage === 'FT' || stage.startsWith('LIVE')
          return (
            <div className={`gwsm-lineupfixture${stage.startsWith('LIVE') ? ' is-live' : ''}`} key={fx[0]}>
              <span className={`gwsm-stage gwsm-stage--${stage.startsWith('LIVE') ? 'live' : stage.toLowerCase()}`}>{stage}</span>
              <MiniCrest text={fx[0]} /><strong>{mobile ? fx[0] : fx[1]}</strong>
              <b>{showScore ? `${fx[2]}–${fx[3]}` : 'vs'}</b>
              <strong>{mobile ? fx[4] : fx[5]}</strong><MiniCrest text={fx[4]} />
              <span>›</span>
            </div>
          )
        })}
      </section>
      <section className="gwsm-lineupdetail">
        <div className="gwsm-cardtitle">{hasLive ? 'LIVE PLAYER STATES' : 'PLAYER STATES'}</div>
        {[
          ['Salah', hasLive ? "67′" : state.id === 'gap' ? 'FT' : '16:30', '12'],
          ['Palmer', hasLive ? "54′" : state.id === 'allft' ? 'FT' : '—', '8'],
          ['Isak', ['allft', 'postseason', 'finalized'].includes(state.id) ? 'DNP' : '20:00', '—'],
        ].map((p) => (
          <div className="gwsm-playerrow" key={p[0]}><span className="gwsm-shirt" /><strong>{p[0]}</strong><span>MID</span><b>{p[1]}</b><strong>{p[2]}</strong></div>
        ))}
      </section>
    </div>
  )
}

function PlayersPage({ state }) {
  return (
    <div className="gwsm-page">
      <div className="gwsm-subnav"><b>Wire</b><span>Owned</span></div>
      <section className="gwsm-pageintro">
        <span>PLAYERS</span><strong>Waiver wire</strong>
        <p>Mostly unchanged during a live match. GW-scoped GP, 60+ and defensive-contribution data roll when Draft FPL changes current gameweek.</p>
      </section>
      <div className="gwsm-filters"><span>All positions</span><span>All clubs</span><span>Sort: Total points</span></div>
      <section className="gwsm-playerlist">
        {[
          ['M. Salah', 'LIV', 'MID', 241, 'MUN (H)'],
          ['C. Palmer', 'CHE', 'MID', 213, 'ARS (A)'],
          ['A. Isak', 'NEW', 'FWD', 197, 'LEE (H)'],
          ['B. Saka', 'ARS', 'MID', 185, 'CHE (H)'],
        ].map((p, i) => <div key={p[0]}><span>{i + 1}</span><span className="gwsm-shirt" /><strong>{p[0]}</strong><span>{p[1]}</span><b>{p[3]}</b><span>{p[4]}</span></div>)}
      </section>
      <div className="gwsm-inline-note">Calendar context: GW {state.gw} · next fixtures update on page load</div>
    </div>
  )
}

function MovesPage({ state }) {
  const pickerGw = state.kind === 'pre' ? 1 : state.nextGw ?? state.gw
  return (
    <div className="gwsm-page">
      <div className="gwsm-subnav"><b>Waivers</b><span>Trades</span><span>Draft</span></div>
      <section className="gwsm-pageintro">
        <span>MOVES</span><strong>Weekly waivers</strong>
        <p>The page does not react to individual live matches. Its default picker follows processed waiver data plus the current/next FPL calendar.</p>
      </section>
      <div className="gwsm-picker">Game Week <strong>{pickerGw}</strong>⌄</div>
      <section className="gwsm-waivers">
        {TEAMS.slice(0, 4).map((t, i) => (
          <div key={t[1]}><MiniCrest text={t[1]} /><strong>{t[0]}</strong><span>{i % 2 ? 'No moves' : 'Konsa → Welbeck'}</span></div>
        ))}
      </section>
      <div className="gwsm-inline-note">No direct deadline, kickoff, minute, score or FT visual state on this page.</div>
    </div>
  )
}

function OtherPage() {
  return (
    <div className="gwsm-page">
      <section className="gwsm-pageintro">
        <span>HERITAGE · MORE · SETTINGS</span>
        <strong>Page content stays static</strong>
        <p>Only the shared header strip and the mobile centre navigation change with gameweek state. These pages contain no direct live-GW branch.</p>
      </section>
      <div className="gwsm-staticgrid">
        <div><b>TCLOT Heritage</b><span>Past champions and league history</span></div>
        <div><b>More</b><span>Heritage, badges and settings links</span></div>
        <div><b>Settings</b><span>Theme and default landing tab</span></div>
        <div><b>Preseason hub</b><span>Separate countdown to Aug 17, 2026</span></div>
      </div>
    </div>
  )
}

function Page({ page, state, mobile }) {
  if (page === 'standings') return <StandingsPage state={state} mobile={mobile} />
  if (page === 'scores') return <ScoresPage state={state} mobile={mobile} />
  if (page === 'lineups') return <LineupsPage state={state} mobile={mobile} />
  if (page === 'players') return <PlayersPage state={state} />
  if (page === 'moves') return <MovesPage state={state} />
  return <OtherPage />
}

function Device({ state, page, mobile, onPage }) {
  return (
    <div className={mobile ? 'gwsm-phone' : 'gwsm-desktop'}>
      <div className="gwsm-devicebar">
        <span>{mobile ? 'MOBILE · 390 × 844' : 'DESKTOP · 1440 × 900'}</span>
        <b>{state.title}</b>
      </div>
      <div className="gwsm-screen">
        <Header state={state} mobile={mobile} />
        {!mobile ? <DesktopNav page={page} onPage={onPage} /> : null}
        <Page page={page} state={state} mobile={mobile} />
        {mobile ? <MobileNav state={state} page={page} onPage={onPage} /> : null}
      </div>
    </div>
  )
}

export function GameweekStatesMockup() {
  const [stateId, setStateId] = useState('postseason')
  const [page, setPage] = useState('standings')
  const state = STATES.find((s) => s.id === stateId) ?? STATES[0]

  return (
    <main className="gwsm">
      <header className="gwsm-top">
        <div>
          <span className="gwsm-kicker">TCLOT STATE ATLAS</span>
          <h1>Gameweek states across the site</h1>
          <p>Actual production behavior rendered as desktop and mobile mockups. Choose a season phase, then inspect every page.</p>
        </div>
        <a href="?">Exit mockups</a>
      </header>

      <section className="gwsm-controls">
        <div>
          <span>1 · GAMEWEEK STATE</span>
          <div className="gwsm-chips">
            {STATES.map((s) => (
              <button type="button" key={s.id} className={s.id === stateId ? 'is-active' : ''} onClick={() => setStateId(s.id)}>
                {s.tab}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>2 · PAGE</span>
          <div className="gwsm-chips">
            {PAGES.map(([id, label]) => (
              <button type="button" key={id} className={id === page ? 'is-active' : ''} onClick={() => setPage(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="gwsm-note">
        <StateDot kind={state.kind} />
        <div><strong>{state.title}</strong><span>{state.header} · {state.headerTail}</span></div>
        <p>{state.kind === 'live' ? 'The FPL deadline has passed. Individual fixtures may still be pre-match, live, between windows, or all full time.' : 'The global shell is not in its live treatment.'}</p>
      </section>

      <section className="gwsm-devices">
        <Device state={state} page={page} mobile={false} onPage={setPage} />
        <Device state={state} page={page} mobile onPage={setPage} />
      </section>

      <section className="gwsm-atlas">
        <div className="gwsm-atlashead">
          <span>ALL GLOBAL HEADER STATES</span>
          <h2>The complete season sequence at a glance</h2>
        </div>
        <div className="gwsm-atlasgrid">
          {STATES.map((s) => (
            <button type="button" key={s.id} className={s.id === stateId ? 'is-active' : ''} onClick={() => setStateId(s.id)}>
              <span className="gwsm-atlaslabel">{s.tab}</span>
              <div className={`gwsm-atlasstatus gwsm-atlasstatus--${s.kind}`}>
                {s.kind === 'live' ? <StateDot kind="live" /> : null}
                <strong>{s.header}</strong><span>·</span><span>{s.headerTail}</span>
              </div>
              <small>Mobile centre: {s.mobileLabel}</small>
            </button>
          ))}
        </div>
      </section>

      <footer className="gwsm-footer">
        Local-only preview · <code>?gwstates=1</code> · production routes and data are unchanged
      </footer>
    </main>
  )
}
