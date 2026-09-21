import './VillainVictoryMockup.css'

/**
 * Local-only gallery (`?villain=1`) — how a villain victory should read
 * on Live Scores, the Live Table, and the Schedule.
 *
 * A villain victory is winning the H2H while sitting 7th in that GW's raw
 * FPL table. Production today only adds a 2px crest ring and a 6% left
 * wash — easy to miss on cream paper. This gallery tries a louder language
 * across the three surfaces that should agree with each other.
 */

const TEAMS = {
  RR: { name: 'Regorasu', full: 'Rokesly Regorasu', short: 'RR', hue: 152 },
  RO: { name: 'Rohirrim', full: 'Hackney Rohirrim', short: 'RO', hue: 96 },
  MO: { name: 'Mordor SFG', full: 'Mordor SFG', short: 'MO', hue: 24 },
  SG: { name: 'Sméagol', full: 'Suffolk Sméagol', short: 'SG', hue: 218 },
  SE: { name: 'Seoul Shire', full: 'Seoul Shire', short: 'SE', hue: 4 },
  GI: { name: 'Gimli', full: 'Toronto Gimli', short: 'GI', hue: 205 },
  BB: { name: 'Balrogs', full: 'Brampton Balrogs', short: 'BB', hue: 268 },
  AB: { name: 'Bilbo', full: 'Atlético Bilbo', short: 'AB', hue: 42 },
}

const TABLE = [
  { rank: 1, team: TEAMS.MO, for: 51, pts: 9, last: 'W' },
  { rank: 2, team: TEAMS.SG, for: 48, pts: 9, last: 'W' },
  { rank: 3, team: TEAMS.RR, for: 47, pts: 9, last: 'W', villain: true },
  { rank: 4, team: TEAMS.SE, for: 44, pts: 6, last: 'L' },
  { rank: 5, team: TEAMS.GI, for: 39, pts: 3, last: 'L' },
  { rank: 6, team: TEAMS.RO, for: 38, pts: 3, last: 'L' },
  { rank: 7, team: TEAMS.BB, for: 31, pts: 3, last: 'W' },
  { rank: 8, team: TEAMS.AB, for: 24, pts: 0, last: 'L' },
]

const SCHEDULE = [
  { home: TEAMS.MO, away: TEAMS.SE, hs: 44, as: 31, villain: null },
  { home: TEAMS.SG, away: TEAMS.BB, hs: 41, as: 28, villain: null },
  { home: TEAMS.RR, away: TEAMS.RO, hs: 42, as: 38, villain: 'home' },
  { home: TEAMS.GI, away: TEAMS.AB, hs: 29, as: 22, villain: null },
]

function Crest({ team, ring = false }) {
  return (
    <span
      className={'vvm-crest' + (ring ? ' vvm-crest--villain' : '')}
      style={{ '--crest-hue': team.hue }}
      aria-hidden="true"
    >
      {team.short}
    </span>
  )
}

function TeamName({ team, pill = false, align = 'left' }) {
  const cls =
    'vvm-name' +
    (pill ? ' vvm-name--pill' : '') +
    (align === 'right' ? ' vvm-name--right' : '')
  return <span className={cls}>{team.name}</span>
}

function VillainLine({ team, tone = 'ink' }) {
  return (
    <span className={'vvm-line vvm-line--' + tone}>
      {team.name} is a villain!
    </span>
  )
}

/** Live Scores scorecard — locked to the production MatchupScorecard shell. */
function Scorecard({ variant }) {
  const villain = TEAMS.RR
  const home = TEAMS.RR
  const away = TEAMS.RO
  const hasBanner = variant === 'banner-pill' || variant === 'banner' || variant === 'loud'
  const hasPill = variant === 'banner-pill' || variant === 'pill' || variant === 'loud'

  return (
    <div
      className={
        'vvm-card' +
        (variant === 'now' ? ' vvm-card--now' : '') +
        (variant === 'loud' ? ' vvm-card--loud' : '')
      }
    >
      <div className={'vvm-meta' + (variant === 'loud' ? ' vvm-meta--loud' : '')}>
        <span className="vvm-meta__ghost">3rd vs 6th</span>
        {hasBanner ? (
          <VillainLine team={villain} tone={variant === 'loud' ? 'cream' : 'purple'} />
        ) : (
          <span className="vvm-meta__mid" aria-hidden="true" />
        )}
        <span className="vvm-meta__ghost">Regorasu 68%</span>
      </div>
      <div className="vvm-hdr">
        <div className="vvm-hdr__side">
          <Crest team={home} ring />
          <TeamName team={home} pill={hasPill} />
        </div>
        <div className="vvm-hdr__score" aria-label="Gameweek score">
          <span className="vvm-hdr__half vvm-hdr__half--winner">42</span>
          <span className="vvm-hdr__sep">–</span>
          <span className="vvm-hdr__half">38</span>
        </div>
        <div className="vvm-hdr__side vvm-hdr__side--away">
          <TeamName team={away} align="right" />
          <Crest team={away} />
        </div>
      </div>
      <div className="vvm-gauge">
        <span className="vvm-gauge__ft">FT</span>
        <span className="vvm-gauge__track">
          <span className="vvm-gauge__fill vvm-gauge__fill--home" />
          <span className="vvm-gauge__notch" />
          <span className="vvm-gauge__fill vvm-gauge__fill--away" />
        </span>
        <span className="vvm-gauge__ft">FT</span>
      </div>
    </div>
  )
}

function LiveTable({ variant }) {
  const hasPill = variant === 'banner-pill' || variant === 'pill' || variant === 'loud'
  const hasChip = variant === 'banner-pill' || variant === 'banner' || variant === 'loud'
  const loudRow = variant === 'loud'

  return (
    <div className="vvm-tablewrap">
      <table className="vvm-table">
        <thead>
          <tr>
            <th className="vvm-col-rank">#</th>
            <th className="vvm-col-team">Team</th>
            <th className="vvm-col-num">For</th>
            <th className="vvm-col-num">PTS</th>
            <th className="vvm-col-last">GW 5</th>
          </tr>
        </thead>
        <tbody>
          <tr className="vvm-divider">
            <td colSpan={5}>Titans</td>
          </tr>
          {TABLE.map((row) => {
            const isV = row.villain
            return (
              <tr
                key={row.rank}
                className={
                  (row.rank === 8 ? 'vvm-row--8th ' : '') +
                  (isV && loudRow ? 'vvm-row--loud ' : '') +
                  (isV && hasPill && variant !== 'loud' ? 'vvm-row--soft ' : '')
                }
              >
                <td className="vvm-col-rank">{row.rank}</td>
                <td className="vvm-col-team">
                  <span className="vvm-teamcell">
                    <Crest team={row.team} ring={isV && variant !== 'now' && variant !== 'pill'} />
                    <TeamName team={row.team} pill={isV && hasPill} />
                    {isV && hasChip ? (
                      <span
                        className={
                          'vvm-chip' + (loudRow ? ' vvm-chip--loud' : '')
                        }
                      >
                        Villain
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="vvm-col-num tabular">{row.for}</td>
                <td className="vvm-col-num tabular vvm-col-pts">{row.pts}</td>
                <td className="vvm-col-last">
                  <i
                    className={
                      'vvm-dot' +
                      (row.last === 'W' ? ' vvm-dot--win' : ' vvm-dot--loss')
                    }
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Schedule({ variant }) {
  const hasBanner = variant === 'banner-pill' || variant === 'banner' || variant === 'loud'
  const hasPill = variant === 'banner-pill' || variant === 'pill' || variant === 'loud'
  const loud = variant === 'loud'

  return (
    <div className="vvm-sched">
      <div className="vvm-sched__band">
        <span className="vvm-sched__gw">GW 05</span>
        <span className="vvm-sched__status">Complete</span>
      </div>
      <ul className="vvm-sched__list">
        {SCHEDULE.map((fx) => {
          const isV = Boolean(fx.villain)
          const homeWin = fx.hs > fx.as
          const awayWin = fx.as > fx.hs
          const villainTeam = fx.villain === 'home' ? fx.home : fx.away
          return (
            <li
              key={fx.home.short}
              className={
                'vvm-sched__item' + (isV && loud ? ' vvm-sched__item--loud' : '')
              }
            >
              {isV && hasBanner ? (
                <div
                  className={
                    'vvm-sched__banner' +
                    (loud ? ' vvm-sched__banner--loud' : '')
                  }
                >
                  <VillainLine team={villainTeam} tone={loud ? 'cream' : 'purple'} />
                </div>
              ) : null}
              <div className="vvm-sched__row">
                <Crest team={fx.home} ring={isV && fx.villain === 'home' && variant !== 'now'} />
                <TeamName
                  team={fx.home}
                  pill={isV && fx.villain === 'home' && hasPill}
                  align="right"
                />
                <span className="vvm-sched__mid tabular">
                  <span
                    className={
                      'vvm-sched__score' +
                      (homeWin ? ' vvm-sched__score--win' : ' vvm-sched__score--lose')
                    }
                  >
                    {fx.hs}
                  </span>
                  <span className="vvm-sched__dash">–</span>
                  <span
                    className={
                      'vvm-sched__score' +
                      (awayWin ? ' vvm-sched__score--win' : ' vvm-sched__score--lose')
                    }
                  >
                    {fx.as}
                  </span>
                </span>
                <TeamName
                  team={fx.away}
                  pill={isV && fx.villain === 'away' && hasPill}
                />
                <Crest team={fx.away} ring={isV && fx.villain === 'away' && variant !== 'now'} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Phone({ children }) {
  return (
    <div className="vvm-phone">
      <div className="vvm-phone__screen">{children}</div>
    </div>
  )
}

const OPTIONS = [
  {
    id: 'now',
    title: 'Today',
    tag: 'Production',
    tagTone: 'muted',
    desc:
      'What ships now: a 2px lilac ring on the crest and a 6% left wash on the scorecard / a faint row tint. No copy, no name treatment. Easy to miss — especially on a 31–38 scoreline you’d otherwise read as a normal win.',
  },
  {
    id: 'banner-pill',
    title: 'Centre line + name pill',
    tag: 'Your idea · recommended',
    tagTone: 'pick',
    desc:
      '“Regorasu is a villain!” sits in the empty middle of the meta strip, in Scorebook lilac. The same name wears a purple pill on the face-off, the Live Table, and the Schedule. Seed + odds stay as ghosts. Two signals: what happened (the line) and who (the pill).',
  },
  {
    id: 'banner',
    title: 'Centre line only',
    tag: 'Quieter',
    tagTone: 'ok',
    desc:
      'Just the sentence. Names stay plain so the card doesn’t grow extra chrome. On the table the line becomes a small “Villain” chip after the name — there’s no meta strip to park a sentence in.',
  },
  {
    id: 'pill',
    title: 'Name pill only',
    tag: 'Quietest',
    tagTone: 'ok',
    desc:
      'No sentence. The villain’s name is the only thing that changes — purple pill, same on every surface. Scannable, but a new visitor won’t know what the pill means without a tooltip.',
  },
  {
    id: 'loud',
    title: 'Purple strip',
    tag: 'Loudest',
    tagTone: 'loud',
    desc:
      'The whole meta / fixture band fills lilac and the sentence goes cream. Table row and schedule row wash to match. Unmissable, maybe a bit costume-y next to racing-green chrome.',
  },
]

export function VillainVictoryMockup() {
  return (
    <div className="vvm">
      <header className="vvm-top">
        <span className="vvm-kicker">Live · villain victory · round 1</span>
        <h1>Make a villain victory obvious</h1>
        <p>
          A villain victory is winning the H2H while 7th in that week’s raw
          FPL table — the “wrong” team taking the three points. Right now the
          only tells are a 2px crest ring and a wash you can miss on cream
          paper. The Live Table doesn’t mark it at all; Schedule neither.
        </p>
        <p>
          Your read is right: <strong>name the villain in the empty centre
          of the top strip</strong>, in purple, and <strong>put a purple pill
          behind their name</strong>. Sentence-case (“Regorasu is a villain!”)
          fits TCLOT better than the old all-caps VILLAIN VICTORY tile, and
          the pill is the “who” that the ring never quite was. Use the
          Scorebook lilac — not the retired electric violet — so it stays in
          the same family as waivers / lore, not a leftover brand-purple.
        </p>
        <p>
          One catch: the meta strip is already busy (seed left, odds right).
          A short name fits; “Hackney Rohirrim is a villain!” would wrap.
          Mockups use the fitted short name the scorecard already prefers.
        </p>
        <a href="/">← Back to app</a>
      </header>

      <div className="vvm-options">
        {OPTIONS.map((opt) => (
          <article key={opt.id} className="vvm-option">
            <div className="vvm-option__head">
              <div className="vvm-option__title-row">
                <span className="vvm-option__id">
                  {opt.id === 'now' ? 'Now' : `Option ${opt.id === 'banner-pill' ? 'A' : opt.id === 'banner' ? 'B' : opt.id === 'pill' ? 'C' : 'D'}`}
                </span>
                <span className="vvm-option__title">{opt.title}</span>
                <span className={'vvm-option__tag vvm-option__tag--' + opt.tagTone}>
                  {opt.tag}
                </span>
              </div>
              <p className="vvm-option__desc">{opt.desc}</p>
            </div>
            <div className="vvm-option__surfaces">
              <figure className="vvm-surface">
                <figcaption>Live Scores</figcaption>
                <Phone>
                  <Scorecard variant={opt.id} />
                </Phone>
              </figure>
              <figure className="vvm-surface">
                <figcaption>Live Table</figcaption>
                <Phone>
                  <LiveTable variant={opt.id} />
                </Phone>
              </figure>
              <figure className="vvm-surface">
                <figcaption>Schedule</figcaption>
                <Phone>
                  <Schedule variant={opt.id} />
                </Phone>
              </figure>
            </div>
          </article>
        ))}
      </div>

      <p className="vvm-note">
        Option A is production: Live Scores centre line + name pill, Live
        Table pill + Villain chip, Schedule banner + name pill. This gallery
        stays as the comparison — open via <code>?villain=1</code>. Sample:
        Regorasu (3rd in the league) beats Rohirrim 42–38 while 7th in that
        GW’s raw FPL table.
      </p>
    </div>
  )
}
