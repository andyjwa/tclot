import './SeedLabelMockup.css'

/**
 * Local-only seed-label style gallery (`?seed=1`).
 *
 * The live face-off "2nd vs 4th" pill (`.live-banner-row__seed`) reads too
 * big / prominent on Scorebook paper. These options keep the same matchup
 * context so we can pick a quieter treatment before wiring it into
 * production.
 */

const FIXTURE = {
  home: { name: 'Toronto', short: 'TO', remaining: 11, score: 44, award: 'HERO' },
  away: { name: 'Hanson', short: 'HA', remaining: 11, score: 53 },
  seed: '2nd vs 4th',
  seedCaps: '2ND VS 4TH',
  seedCompact: '2 · 4',
  homeRank: '2nd',
  awayRank: '4th',
}

function Crest({ label, alt = false }) {
  return (
    <span className={'seedm-crest' + (alt ? ' seedm-crest--alt' : '')} aria-hidden="true">
      {label}
    </span>
  )
}

function MiniRow({
  homeRankChip = false,
  awayRankChip = false,
  homeAward = true,
}) {
  const { home, away } = FIXTURE
  return (
    <div className="seedm-row">
      <div className="seedm-row__side">
        <span className="seedm-pill">{home.remaining}</span>
        <span className="seedm-team">
          <span className="seedm-names">
            <span className="seedm-name">{home.name}</span>
            {homeAward ? <span className="seedm-award">{home.award}</span> : null}
            {homeRankChip ? <span className="seedm-rankchip">{FIXTURE.homeRank}</span> : null}
          </span>
          <Crest label={home.short} />
        </span>
      </div>

      <div className="seedm-score" aria-label={`${home.score} to ${away.score}`}>
        <span className="seedm-score__n seedm-score__n--home">{home.score}</span>
        <span className="seedm-score__sep" aria-hidden="true">
          –
        </span>
        <span className="seedm-score__n seedm-score__n--away seedm-score__n--winner">
          {away.score}
        </span>
      </div>

      <div className="seedm-row__side seedm-row__side--away">
        <span className="seedm-team">
          <Crest label={away.short} alt />
          <span className="seedm-names">
            <span className="seedm-name">{away.name}</span>
            {awayRankChip ? <span className="seedm-rankchip">{FIXTURE.awayRank}</span> : null}
          </span>
        </span>
        <span className="seedm-pill">{away.remaining}</span>
      </div>
    </div>
  )
}

const OPTIONS = [
  {
    id: 'A',
    title: 'Current pill',
    tag: 'Too loud',
    tagTone: 'loud',
    desc: 'Production FotMob group pill: 20px tall, bold tracked caps, soft fill. Reads as a section header more than meta.',
    render: () => (
      <>
        <span className="seedm-seed--a">{FIXTURE.seedCaps}</span>
        <MiniRow />
      </>
    ),
  },
  {
    id: 'B',
    title: 'Quiet pill',
    tag: 'Locked · shipped',
    tagTone: 'quiet',
    desc: 'Same left-aligned placement, but shorter (15px), Geist Mono, hairline border, less weight — matches Waivers cream chips. Now live on Scores face-offs (`.live-banner-row__seed`).',
    render: () => (
      <>
        <span className="seedm-seed--b">{FIXTURE.seedCaps}</span>
        <MiniRow />
      </>
    ),
  },
  {
    id: 'C',
    title: 'Bare eyebrow',
    tag: 'Quiet',
    tagTone: 'quiet',
    desc: 'Drop the pill chrome entirely. Mono tracked caps only — same language as schedule GW bands / draft round headers.',
    render: () => (
      <>
        <span className="seedm-seed--c">{FIXTURE.seedCaps}</span>
        <MiniRow />
      </>
    ),
  },
  {
    id: 'D',
    title: 'Hairline label',
    tag: 'Quiet',
    tagTone: 'quiet',
    desc: 'Bare mono label with a short underline. Gives a tiny structure cue without the rounded mass of a pill.',
    render: () => (
      <>
        <span className="seedm-seed--d">{FIXTURE.seedCaps}</span>
        <MiniRow />
      </>
    ),
  },
  {
    id: 'E',
    title: 'Centered over score',
    tag: 'Quiet',
    tagTone: 'quiet',
    desc: 'Move the seeding off the left edge and park it above the score column so team names stay the first read.',
    render: () => (
      <div className="seedm-seed--e-wrap">
        <span className="seedm-seed--e">{FIXTURE.seedCaps}</span>
        <MiniRow />
      </div>
    ),
  },
  {
    id: 'F',
    title: 'Compact ranks',
    tag: 'Quietest',
    tagTone: 'quiet',
    desc: 'Strip “vs” and ordinals to digits + middot (`2 · 4`). Smallest visual budget; still scannable for seeding context.',
    render: () => (
      <>
        <span className="seedm-seed--f">
          2<i>·</i>4
        </span>
        <MiniRow />
      </>
    ),
  },
  {
    id: 'G',
    title: 'Per-side rank chips',
    tag: 'Different model',
    tagTone: 'quiet',
    desc: 'No top eyebrow. Tiny cream rank chips under each name (Waivers/player-detail chip recipe). Seeding stays attached to the team.',
    render: () => <MiniRow homeRankChip awayRankChip homeAward={false} />,
  },
]

export function SeedLabelMockup() {
  return (
    <div className="seedm">
      <header className="seedm-top">
        <span className="seedm-kicker">Scores · face-off seed label</span>
        <h1>Style options for “2nd vs 4th”</h1>
        <p>
          The current seeding pill sits above each live face-off and feels a
          notch too big on Scorebook paper. Pick a quieter treatment; nothing
          here is wired into production yet.
        </p>
        <a href="/">← Back to app</a>
      </header>

      <div className="seedm-grid">
        {OPTIONS.map((opt) => (
          <article
            key={opt.id}
            className={'seedm-card' + (opt.id === 'A' ? ' seedm-card--current' : '')}
          >
            <div className="seedm-card__head">
              <span className="seedm-card__id">Option {opt.id}</span>
              <span className="seedm-card__title">{opt.title}</span>
              <span
                className={
                  'seedm-card__tag seedm-card__tag--' + (opt.tagTone === 'loud' ? 'loud' : 'quiet')
                }
              >
                {opt.tag}
              </span>
              <p className="seedm-card__desc">{opt.desc}</p>
            </div>
            <div className="seedm-card__preview">{opt.render()}</div>
          </article>
        ))}
      </div>

      <p className="seedm-note">
        <strong>Locked:</strong> Option B shipped to production
        (<code>.live-banner-row__seed</code>). Gallery kept for reference —
        open via <code>?seed=1</code>.
      </p>
    </div>
  )
}
