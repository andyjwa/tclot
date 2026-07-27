import './RebrandGallery.css'

/**
 * Local-only rebrand gallery (`?rebrand=1`).
 *
 * Twelve visual directions for the live app. Each direction is a full
 * multi-colour system: one primary accent for selection/chrome plus three
 * "pop" colours (green / rust / lilac families) used sparingly for data,
 * live states, form dots and tags. Nav treatment varies per direction
 * (underline / pill / boxed / dot) so the menu design is part of the pitch.
 */

const DIRECTIONS = [
  {
    id: '01',
    name: 'Paper & Rust',
    note: 'Warm editorial paper, rust selection, green + lilac data pops',
    ui: 'Archivo',
    display: 'Fraunces',
    nav: 'underline',
    bg: '#f6f1e7',
    surface: '#fdfaf3',
    surface2: '#eee7d8',
    ink: '#1e1b16',
    muted: '#7d7466',
    line: '#ddd3c1',
    accent: '#a64b2a',
    tint: '#f3ddd2',
    onAccent: '#fdf6ef',
    popGreen: '#2f5d50',
    popRust: '#a64b2a',
    popLilac: '#8d7bbd',
    radius: '14px',
  },
  {
    id: '02',
    name: 'Ink Noir',
    note: 'Near-black shell, lilac as the hero pop, rust + mint counterpoints',
    ui: 'Space Grotesk',
    display: 'Space Grotesk',
    nav: 'pill',
    dark: true,
    bg: '#141519',
    surface: '#1c1d23',
    surface2: '#25262e',
    ink: '#ece8df',
    muted: '#8f8d96',
    line: '#33343d',
    accent: '#b6a6e3',
    tint: '#2b2836',
    onAccent: '#17141f',
    popGreen: '#9cc5ad',
    popRust: '#c96f4a',
    popLilac: '#b6a6e3',
    radius: '12px',
  },
  {
    id: '03',
    name: 'Club Bottle',
    note: 'Bottle green authority with butter gold and a rust live signal',
    ui: 'Bricolage Grotesque',
    display: 'Bricolage Grotesque',
    nav: 'boxed',
    bg: '#efede3',
    surface: '#faf8ef',
    surface2: '#e5e2d2',
    ink: '#17281f',
    muted: '#6d7a70',
    line: '#d2cfba',
    accent: '#1e4d3b',
    tint: '#dbe6dc',
    onAccent: '#f3f7ec',
    popGreen: '#1e4d3b',
    popRust: '#b3572f',
    popLilac: '#d9a441',
    radius: '10px',
  },
  {
    id: '04',
    name: 'Lilac Field',
    note: 'Cool grey-lilac paper, deep lilac used precisely, green table logic',
    ui: 'Sora',
    display: 'Sora',
    nav: 'dot',
    bg: '#efecf4',
    surface: '#faf9fc',
    surface2: '#e4e0ec',
    ink: '#211e28',
    muted: '#75707f',
    line: '#d5cfe1',
    accent: '#7a63c4',
    tint: '#e6dff5',
    onAccent: '#f8f5ff',
    popGreen: '#33604a',
    popRust: '#b3572f',
    popLilac: '#7a63c4',
    radius: '16px',
  },
  {
    id: '05',
    name: 'Terracotta Social',
    note: 'Clay warmth, serif headlines, forest green doing the quiet work',
    ui: 'Manrope',
    display: 'Instrument Serif',
    nav: 'pill',
    bg: '#f2e7dc',
    surface: '#fbf4ec',
    surface2: '#eadbcc',
    ink: '#2a211a',
    muted: '#83756a',
    line: '#ddcbb9',
    accent: '#b3572f',
    tint: '#f2dccd',
    onAccent: '#fdf4ec',
    popGreen: '#41604b',
    popRust: '#b3572f',
    popLilac: '#9a86c8',
    radius: '18px',
  },
  {
    id: '06',
    name: 'Swiss Fixture',
    note: 'Hard white grid, ink structure, three pops with equal billing',
    ui: 'Archivo',
    display: 'Archivo',
    nav: 'underline',
    bg: '#fcfcfa',
    surface: '#ffffff',
    surface2: '#f0f0ec',
    ink: '#101110',
    muted: '#6d6e6a',
    line: '#dcdcd6',
    accent: '#101110',
    tint: '#ecece6',
    onAccent: '#ffffff',
    popGreen: '#256c4e',
    popRust: '#c14f24',
    popLilac: '#7f6bc9',
    radius: '4px',
  },
  {
    id: '07',
    name: 'Midnight Garden',
    note: 'Deep green-black night, mint glow, lilac and gold accents',
    ui: 'Manrope',
    display: 'Newsreader',
    nav: 'dot',
    dark: true,
    bg: '#10201b',
    surface: '#172a24',
    surface2: '#1f352d',
    ink: '#e9f0e9',
    muted: '#8fa79c',
    line: '#2c4239',
    accent: '#a8d5c2',
    tint: '#22392f',
    onAccent: '#0f231c',
    popGreen: '#a8d5c2',
    popRust: '#d9a441',
    popLilac: '#b9a7e6',
    radius: '14px',
  },
  {
    id: '08',
    name: 'Butter Ledger',
    note: 'Butter-cream paper, bookkeeping greens, rust numerals that pop',
    ui: 'IBM Plex Sans',
    display: 'IBM Plex Sans',
    nav: 'boxed',
    bg: '#f8f3e3',
    surface: '#fefbf1',
    surface2: '#efe8d1',
    ink: '#232014',
    muted: '#7d775f',
    line: '#e0d8ba',
    accent: '#3a6b4c',
    tint: '#e0ead9',
    onAccent: '#f4f9ee',
    popGreen: '#3a6b4c',
    popRust: '#b04f26',
    popLilac: '#8f7fc0',
    radius: '8px',
  },
  {
    id: '09',
    name: 'Blush Ink',
    note: 'Blush paper and wine-rust, serif voice, lilac details',
    ui: 'Archivo',
    display: 'Fraunces',
    nav: 'underline',
    bg: '#f5ede9',
    surface: '#fdf7f4',
    surface2: '#eee0da',
    ink: '#271b17',
    muted: '#84726b',
    line: '#e0cfc7',
    accent: '#8e3b2f',
    tint: '#f1dcd6',
    onAccent: '#fbf1ee',
    popGreen: '#3c614d',
    popRust: '#8e3b2f',
    popLilac: '#9c89c9',
    radius: '12px',
  },
  {
    id: '10',
    name: 'Pistachio Modern',
    note: 'Soft pistachio field, generous radii, confident green selection',
    ui: 'Sora',
    display: 'Sora',
    nav: 'pill',
    bg: '#edf2e4',
    surface: '#f9fbf4',
    surface2: '#e2e9d5',
    ink: '#1b231a',
    muted: '#6e7a68',
    line: '#d1dac2',
    accent: '#3d6b4f',
    tint: '#dce8d8',
    onAccent: '#f2f8ef',
    popGreen: '#3d6b4f',
    popRust: '#bc5b2e',
    popLilac: '#8d7bbd',
    radius: '20px',
  },
  {
    id: '11',
    name: 'Ink & Mint Court',
    note: 'Ink-filled selection, mint tints, display type with attitude',
    ui: 'Archivo',
    display: 'Syne',
    nav: 'pill',
    bg: '#f1f3ef',
    surface: '#fbfcfa',
    surface2: '#e5e9e2',
    ink: '#171a17',
    muted: '#6e746d',
    line: '#d4d9d0',
    accent: '#171a17',
    tint: '#dce8e0',
    onAccent: '#f5faf5',
    popGreen: '#2c7358',
    popRust: '#c1552c',
    popLilac: '#8d7bbd',
    radius: '10px',
  },
  {
    id: '12',
    name: 'Velvet Study',
    note: 'Dark aubergine-ink library, lilac and gold picked out like foil',
    ui: 'Manrope',
    display: 'Instrument Serif',
    nav: 'underline',
    dark: true,
    bg: '#1a1620',
    surface: '#221d29',
    surface2: '#2b2434',
    ink: '#ede7e0',
    muted: '#98909f',
    line: '#3a3145',
    accent: '#c3b2ec',
    tint: '#302740',
    onAccent: '#1c1524',
    popGreen: '#8fbfa4',
    popRust: '#d9a441',
    popLilac: '#c3b2ec',
    radius: '12px',
  },
]

/**
 * Round 3 — the "Butter & Swiss" realm. Every direction keeps the Swiss
 * Fixture underline menu and works the Butter Ledger palette family:
 * cream/butter papers, bookkeeping greens, rust numerals, gold + lilac
 * details.
 */
const ROUND3 = [
  {
    id: '13',
    name: 'Ledger Swiss',
    note: 'Butter Ledger palette on the Swiss underline menu — the literal combo',
    ui: 'Archivo',
    display: 'Archivo',
    nav: 'underline',
    bg: '#f8f3e3',
    surface: '#fefbf1',
    surface2: '#efe8d1',
    ink: '#232014',
    muted: '#7d775f',
    line: '#e0d8ba',
    accent: '#3a6b4c',
    tint: '#e0ead9',
    onAccent: '#f4f9ee',
    popGreen: '#3a6b4c',
    popRust: '#b04f26',
    popLilac: '#8f7fc0',
    radius: '6px',
  },
  {
    id: '14',
    name: 'Vellum',
    note: 'Paler parchment, serif voice, ink-green selection with gold moments',
    ui: 'Archivo',
    display: 'Fraunces',
    nav: 'underline',
    bg: '#faf6ea',
    surface: '#fffdf6',
    surface2: '#f1ebd9',
    ink: '#26261a',
    muted: '#807a66',
    line: '#e3dcc4',
    accent: '#2e5c41',
    tint: '#dfe9dc',
    onAccent: '#f2f8ee',
    popGreen: '#2e5c41',
    popRust: '#ad5227',
    popLilac: '#d9a441',
    radius: '8px',
  },
  {
    id: '15',
    name: 'Scorebook',
    note: 'Racing green on cream, ledger numerals, rust reserved for losses',
    ui: 'IBM Plex Sans',
    display: 'IBM Plex Sans',
    nav: 'underline',
    bg: '#f6f1e2',
    surface: '#fdfaf0',
    surface2: '#ece5cf',
    ink: '#1f2a1f',
    muted: '#77775f',
    line: '#ddd5b8',
    accent: '#1f4a38',
    tint: '#dae5da',
    onAccent: '#eff6ec',
    popGreen: '#1f4a38',
    popRust: '#b04f26',
    popLilac: '#8f7fc0',
    radius: '5px',
  },
  {
    id: '16',
    name: 'Meadow Gold',
    note: 'Warmer butter field, olive-leaning green, lilac allowed in quietly',
    ui: 'Manrope',
    display: 'Manrope',
    nav: 'underline',
    bg: '#f6eed8',
    surface: '#fdf8ea',
    surface2: '#ede3c6',
    ink: '#282316',
    muted: '#83795e',
    line: '#e0d5b1',
    accent: '#46603c',
    tint: '#e2e7d2',
    onAccent: '#f3f7ec',
    popGreen: '#46603c',
    popRust: '#b3572f',
    popLilac: '#9686c4',
    radius: '10px',
  },
  {
    id: '17',
    name: 'Fresh Cut',
    note: 'Green-tinted paper, deeper pitch green, butter gold doing the tags',
    ui: 'Bricolage Grotesque',
    display: 'Bricolage Grotesque',
    nav: 'underline',
    bg: '#f4f4e6',
    surface: '#fcfcf2',
    surface2: '#e9ead4',
    ink: '#20281d',
    muted: '#767d64',
    line: '#dadcbd',
    accent: '#2d5a44',
    tint: '#dde7da',
    onAccent: '#f0f7ee',
    popGreen: '#2d5a44',
    popRust: '#bc5b2e',
    popLilac: '#d9a441',
    radius: '8px',
  },
  {
    id: '18',
    name: 'Club Paper',
    note: 'Off-white cream, near-ink green selection, serif score, rust numerals',
    ui: 'Archivo',
    display: 'Instrument Serif',
    nav: 'underline',
    bg: '#f9f5ea',
    surface: '#fffcf4',
    surface2: '#efe9d8',
    ink: '#212a20',
    muted: '#7c7a68',
    line: '#e2dbc5',
    accent: '#1c3a2d',
    tint: '#dee6da',
    onAccent: '#f1f7ee',
    popGreen: '#356b4f',
    popRust: '#ad5227',
    popLilac: '#9686c4',
    radius: '7px',
  },
]

/**
 * Round 4 — Scorebook font studies. Same palette (racing green on cream),
 * Swiss underline menu, six different UI fonts, judged at real mobile sizes.
 * Waldenburg itself is a paid Kimera face; Schibsted / Instrument / Hanken /
 * Familjen are its closest free stand-ins.
 */
const SCOREBOOK = {
  bg: '#f6f1e2',
  surface: '#fdfaf0',
  surface2: '#ece5cf',
  ink: '#1f2a1f',
  muted: '#77775f',
  line: '#ddd5b8',
  accent: '#1f4a38',
  tint: '#dae5da',
  onAccent: '#eff6ec',
  popGreen: '#1f4a38',
  popRust: '#b04f26',
  popLilac: '#8f7fc0',
  radius: '5px',
}

const FONT_STUDIES = [
  { id: '15a', font: 'Schibsted Grotesk', note: 'Closest free stand-in for Waldenburg — tall x-height, warm grotesque' },
  { id: '15b', font: 'Instrument Sans', note: 'Modern neutral with slight squarishness, very 2026' },
  { id: '15c', font: 'Hanken Grotesk', note: 'Soft humanist grotesque, friendliest of the set' },
  { id: '15d', font: 'Familjen Grotesk', note: 'Compact and characterful, slightly editorial' },
  { id: '15e', font: 'Geist', note: 'Already in the app for numerics — cool and technical' },
  { id: '15f', font: 'IBM Plex Sans', note: 'The original Scorebook pick, for reference' },
]

const NAV_ITEMS = ['Table', 'Schedule', 'Stats', 'Moves', 'Scores', 'Players', 'More']

const FORM = ['w', 'w', 'd', 'l', 'w']

function Icon({ name }) {
  const paths = {
    table: <><path d="M4 5h16M4 12h16M4 19h16" /><path d="M9 5v14" /></>,
    moves: <><path d="M5 7h10" /><path d="m12 4 3 3-3 3" /><path d="M19 17H9" /><path d="m12 14-3 3 3 3" /></>,
    live: <><circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></>,
    players: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3.5 20c.7-4 2.5-6 5.5-6s4.8 2 5.5 6M15 15c2.8.1 4.5 1.8 5 5" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function FormDots() {
  return (
    <span className="rb-form" aria-hidden="true">
      {FORM.map((r, i) => <i className={`rb-form__dot rb-form__dot--${r}`} key={i} />)}
    </span>
  )
}

function DesktopPreview({ nav }) {
  return (
    <div className="rb-desktop">
      <header className="rb-header">
        <span className="rb-brand">TCLOT</span>
        <span className="rb-season">2026/27 · DRAFT H2H</span>
        <span className="rb-live"><i /> LIVE · GW 4</span>
      </header>
      <nav className={`rb-topnav rb-topnav--${nav}`} aria-label="Desktop menu preview">
        {NAV_ITEMS.map((item, index) => (
          <span className={index === 0 ? 'is-active' : ''} key={item}>{item}</span>
        ))}
      </nav>
      <div className="rb-hero">
        <div className="rb-hero__score">
          <span>Bellsprouts</span>
          <strong>44<em>–</em>38</strong>
          <span>Wiggum</span>
        </div>
        <div className="rb-hero__tags">
          <b className="rb-tag rb-tag--green">3 playing</b>
          <b className="rb-tag rb-tag--rust">Deadline Fri</b>
          <b className="rb-tag rb-tag--lilac">Waivers open</b>
        </div>
      </div>
      <div className="rb-subnav">
        <span className="is-active">Standings</span>
        <span>Fixtures</span>
        <span>Form</span>
      </div>
      <div className="rb-content">
        <section className="rb-table">
          <div className="rb-table-title"><strong>League table</strong><small>GW 4</small></div>
          {[
            ['1', 'Dalston Bellsprouts', '9'],
            ['2', 'Soul of Ze Moles', '7'],
            ['3', 'Toronto Wiggum', '6'],
          ].map(([rank, team, points]) => (
            <div className="rb-row" key={team}>
              <b>{rank}</b>
              <span className="rb-avatar">{team[0]}</span>
              <span className="rb-row__team">{team}</span>
              <FormDots />
              <strong>{points}</strong>
            </div>
          ))}
        </section>
        <aside className="rb-menu">
          <small>MORE</small>
          <span className="is-selected">Heritage <b>›</b></span>
          <span>League info <b>›</b></span>
          <span>Settings <b>›</b></span>
        </aside>
      </div>
    </div>
  )
}

function MobilePreview() {
  return (
    <div className="rb-phone">
      <div className="rb-phone-head">
        <strong>TCLOT</strong>
        <span className="rb-live"><i /> GW 4</span>
      </div>
      <div className="rb-phone-card">
        <small>YOUR MATCHUP</small>
        <div><span>Bellsprouts</span><strong>44–38</strong><span>Wiggum</span></div>
      </div>
      <div className="rb-bars" aria-hidden="true">
        <i className="rb-bars__bar rb-bars__bar--green" style={{ height: '26px' }} />
        <i className="rb-bars__bar rb-bars__bar--rust" style={{ height: '14px' }} />
        <i className="rb-bars__bar rb-bars__bar--lilac" style={{ height: '20px' }} />
        <i className="rb-bars__bar rb-bars__bar--green" style={{ height: '32px' }} />
        <i className="rb-bars__bar rb-bars__bar--rust" style={{ height: '10px' }} />
        <i className="rb-bars__bar rb-bars__bar--lilac" style={{ height: '24px' }} />
      </div>
      <nav className="rb-bottomnav" aria-label="Mobile menu preview">
        <span className="is-active"><em><Icon name="table" /></em><small>Table</small></span>
        <span><em><Icon name="moves" /></em><small>Moves</small></span>
        <span className="is-live"><em><Icon name="live" /></em><small>Live</small></span>
        <span><em><Icon name="players" /></em><small>Players</small></span>
        <span><em><Icon name="more" /></em><small>More</small></span>
      </nav>
    </div>
  )
}

/** Full-size phone mock at realistic type sizes — for judging fonts on mobile. */
function FontStudy({ study }) {
  const style = {
    '--rb-bg': SCOREBOOK.bg,
    '--rb-surface': SCOREBOOK.surface,
    '--rb-surface-2': SCOREBOOK.surface2,
    '--rb-ink': SCOREBOOK.ink,
    '--rb-muted': SCOREBOOK.muted,
    '--rb-line': SCOREBOOK.line,
    '--rb-accent': SCOREBOOK.accent,
    '--rb-tint': SCOREBOOK.tint,
    '--rb-on-accent': SCOREBOOK.onAccent,
    '--rb-green': SCOREBOOK.popGreen,
    '--rb-rust': SCOREBOOK.popRust,
    '--rb-lilac': SCOREBOOK.popLilac,
    '--rb-radius': SCOREBOOK.radius,
    '--rb-font': `'${study.font}', sans-serif`,
  }

  return (
    <article className="rb-study" style={style}>
      <div className="rb-study__head">
        <span>{study.id}</span>
        <div>
          <h3>{study.font}</h3>
          <p>{study.note}</p>
        </div>
      </div>
      <div className="rb-bigphone">
        <header className="rb-bigphone__top">
          <strong>TCLOT</strong>
          <span className="rb-bigphone__live"><i /> LIVE · GW 4</span>
        </header>
        <nav className="rb-bigphone__nav" aria-label={`Mobile menu preview — ${study.font}`}>
          <span className="is-active">Table</span>
          <span>Schedule</span>
          <span>Stats</span>
          <span>Moves</span>
          <span>Scores</span>
        </nav>
        <div className="rb-bigphone__match">
          <small>YOUR MATCHUP · LIVE</small>
          <div className="rb-bigphone__score">
            <span>Dalston Bellsprouts</span>
            <strong>44–38</strong>
            <span>Toronto Wiggum</span>
          </div>
          <div className="rb-bigphone__tags">
            <b className="rb-tag rb-tag--green">3 playing</b>
            <b className="rb-tag rb-tag--rust">2 behind</b>
            <b className="rb-tag rb-tag--lilac">Waivers open</b>
          </div>
        </div>
        <div className="rb-bigphone__section">League table</div>
        {[
          ['1', 'Dalston Bellsprouts', '9'],
          ['2', 'Soul of Ze Moles', '7'],
          ['3', 'Toronto Wiggum', '6'],
          ['4', 'Essex Ratigans', '4'],
        ].map(([rank, team, points]) => (
          <div className="rb-bigphone__row" key={team}>
            <b>{rank}</b>
            <span className="rb-avatar">{team[0]}</span>
            <span className="rb-bigphone__team">{team}</span>
            <FormDots />
            <strong>{points}</strong>
          </div>
        ))}
        <nav className="rb-bigphone__dock" aria-label={`Bottom navigation preview — ${study.font}`}>
          <span className="is-active"><em><Icon name="table" /></em><small>Table</small></span>
          <span><em><Icon name="moves" /></em><small>Moves</small></span>
          <span className="is-live"><em><Icon name="live" /></em><small>Live</small></span>
          <span><em><Icon name="players" /></em><small>Players</small></span>
          <span><em><Icon name="more" /></em><small>More</small></span>
        </nav>
      </div>
    </article>
  )
}

function Direction({ direction }) {
  const style = {
    '--rb-bg': direction.bg,
    '--rb-surface': direction.surface,
    '--rb-surface-2': direction.surface2,
    '--rb-ink': direction.ink,
    '--rb-muted': direction.muted,
    '--rb-line': direction.line,
    '--rb-accent': direction.accent,
    '--rb-tint': direction.tint,
    '--rb-on-accent': direction.onAccent,
    '--rb-green': direction.popGreen,
    '--rb-rust': direction.popRust,
    '--rb-lilac': direction.popLilac,
    '--rb-radius': direction.radius,
    '--rb-font': `'${direction.ui}', sans-serif`,
    '--rb-display': `'${direction.display}', serif`,
  }

  return (
    <article className={`rb-direction${direction.dark ? ' is-dark' : ''}`} style={style}>
      <div className="rb-direction-title">
        <span>{direction.id}</span>
        <div>
          <h2>{direction.name}</h2>
          <p>{direction.note}</p>
        </div>
        <code>{direction.ui}{direction.display !== direction.ui ? ` + ${direction.display}` : ''}</code>
      </div>
      <div className="rb-previews">
        <DesktopPreview nav={direction.nav} />
        <MobilePreview />
      </div>
      <div className="rb-swatches">
        {[direction.ink, direction.accent, direction.popGreen, direction.popRust, direction.popLilac].map((colour, i) => (
          <span key={`${colour}-${i}`}><i style={{ background: colour }} />{colour}</span>
        ))}
      </div>
    </article>
  )
}

export function RebrandGallery() {
  return (
    <main className="rebrand-gallery">
      <header className="rb-intro">
        <div>
          <span className="rb-kicker">TCLOT · VISUAL DIRECTIONS · ROUND 4</span>
          <h1>Scorebook,<br />at phone size.</h1>
        </div>
        <p>
          Same Scorebook palette, six UI fonts, rendered at real mobile type
          sizes. Waldenburg is a paid Kimera face (the Sanity / ElevenLabs
          font) — Schibsted Grotesk is its closest free stand-in, shown first.
          Rust is data ink only: losses, deficits, negative movement. Never
          decoration.
        </p>
      </header>
      <div className="rb-studies">
        {FONT_STUDIES.map((study) => <FontStudy study={study} key={study.id} />)}
      </div>
      <header className="rb-intro rb-intro--secondary">
        <div>
          <span className="rb-kicker">ROUND 3 · BUTTER &amp; SWISS</span>
          <h1>Butter papers,<br />Swiss menus.</h1>
        </div>
        <p>
          Six directions in the Butter Ledger realm — cream and butter papers,
          bookkeeping greens, rust numerals, gold and lilac details — all on
          the Swiss Fixture underline menu.
        </p>
      </header>
      <div className="rb-grid">
        {ROUND3.map((direction) => <Direction direction={direction} key={direction.id} />)}
      </div>
      <header className="rb-intro rb-intro--secondary">
        <div>
          <span className="rb-kicker">ROUND 2 · FOR REFERENCE</span>
          <h1>Rust, ink, lilac,<br />and proper greens.</h1>
        </div>
        <p>
          The earlier twelve multi-colour systems, each with its own menu
          language — underline tabs, filled pills, boxed tabs, dot markers.
        </p>
      </header>
      <div className="rb-grid">
        {DIRECTIONS.map((direction) => <Direction direction={direction} key={direction.id} />)}
      </div>
    </main>
  )
}
