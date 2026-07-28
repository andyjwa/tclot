import './TradePillsMockup.css'

/**
 * Local-only trade score-pill gallery (`?tradepills=1`).
 *
 * Moves › Trades currently shows bare centre totals / per-player points.
 * These options try Scorebook pill language (Live Table greige, quiet chips,
 * face-off winner glass) before wiring one into production.
 */

const SAMPLE = {
  gw: 'GW 9',
  date: 'Oct 20',
  home: { name: 'Toronto', short: 'TO', pts: 100 },
  away: { name: 'Morpeth', short: 'MJ', pts: 30 },
  pair: {
    home: { name: 'Gyökeres', kept: true },
    away: { name: 'Isak', kept: false, range: 'GW 9–35' },
    homePts: 100,
    awayPts: 30,
  },
}

function Crest({ label, alt = false }) {
  return (
    <span className={'tpm-crest' + (alt ? ' tpm-crest--alt' : '')} aria-hidden>
      {label}
    </span>
  )
}

function Score({ home, away, homeWin, size = 'total', variant }) {
  return (
    <span
      className={`tpm-score tpm-score--${size}`}
      aria-label={`${home} to ${away}`}
      data-variant={variant}
    >
      <span className={'tpm-score__n' + (homeWin ? ' is-win' : '')}>{home}</span>
      <span className="tpm-score__sep" aria-hidden>
        –
      </span>
      <span className={'tpm-score__n' + (!homeWin ? ' is-win' : '')}>{away}</span>
    </span>
  )
}

function MiniTrade({ variantClass }) {
  const { home, away, pair } = SAMPLE
  const homeWin = home.pts >= away.pts
  const pairHomeWin = pair.homePts >= pair.awayPts
  return (
    <div className={`tpm-trade ${variantClass}`}>
      <div className="tpm-trade__head">
        <span className="tpm-trade__gw">{SAMPLE.gw}</span>
        <span className="tpm-trade__date">{SAMPLE.date}</span>
      </div>
      <div className="tpm-trade__teams">
        <div className="tpm-team">
          <Crest label={home.short} />
          <span className="tpm-team__name">{home.name}</span>
        </div>
        <Score home={home.pts} away={away.pts} homeWin={homeWin} size="total" />
        <div className="tpm-team tpm-team--away">
          <Crest label={away.short} alt />
          <span className="tpm-team__name">{away.name}</span>
        </div>
      </div>
      <div className="tpm-pair">
        <div className="tpm-pl">
          <span className="tpm-pl__badge" aria-hidden />
          <span className="tpm-pl__id">
            <span className="tpm-pl__name">{pair.home.name}</span>
            <span className="tpm-pl__tenure">
              <span className="tpm-pl__dot" />
              on squad
            </span>
          </span>
        </div>
        <Score
          home={pair.homePts}
          away={pair.awayPts}
          homeWin={pairHomeWin}
          size="pair"
        />
        <div className="tpm-pl tpm-pl--away">
          <span className="tpm-pl__badge" aria-hidden />
          <span className="tpm-pl__id">
            <span className="tpm-pl__name">{pair.away.name}</span>
            <span className="tpm-pl__tenure">
              <span className="tpm-pl__dot tpm-pl__dot--gone" />
              {pair.away.range}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

const OPTIONS = [
  {
    id: 'A',
    title: 'Current · bare scores',
    tag: 'Today',
    tagTone: 'loud',
    desc: 'Production: plain centre totals (winner in brand green) and muted per-player points. No pill chrome.',
    cls: 'tpm-v-a',
  },
  {
    id: 'B',
    title: 'Linked Live-Table capsule',
    tag: 'Recommended',
    tagTone: 'quiet',
    desc: 'One olive greige pill around the whole “100 – 30” pair — same recipe as Live Table PTS / Points Feed chips. Winner number still brand green.',
    cls: 'tpm-v-b',
  },
  {
    id: 'C',
    title: 'Split quiet chips',
    tag: 'Quiet',
    tagTone: 'quiet',
    desc: 'Each number in its own cream chip with hairline border. Winner chip gets the brand tint; loser stays muted.',
    cls: 'tpm-v-c',
  },
  {
    id: 'D',
    title: 'Winner glass only',
    tag: 'Face-off match',
    tagTone: 'quiet',
    desc: 'Mirrors live Scores face-off Option C: soft brand wash behind the winning number only. Losing number stays bare ink/muted.',
    cls: 'tpm-v-d',
  },
  {
    id: 'E',
    title: 'Dual cream chips · no winner colour',
    tag: 'Quietest',
    tagTone: 'quiet',
    desc: 'Both numbers in identical quiet pills; outcome is implied by magnitude only. Calmest read, least “scoreboard”.',
    cls: 'tpm-v-e',
  },
]

export function TradePillsMockup() {
  return (
    <div className="tpm">
      <header className="tpm-top">
        <span className="tpm-kicker">Moves · Trades · score pills</span>
        <h1>Style options for trade scores</h1>
        <p>
          Bring the centre H2H totals and per-player points onto Scorebook
          pill language. Pick a direction; nothing here is wired into
          production yet.
        </p>
        <a href="/">← Back to app</a>
      </header>

      <div className="tpm-grid">
        {OPTIONS.map((opt) => (
          <article
            key={opt.id}
            className={'tpm-card' + (opt.id === 'A' ? ' tpm-card--current' : '')}
          >
            <div className="tpm-card__head">
              <span className="tpm-card__id">Option {opt.id}</span>
              <span className="tpm-card__title">{opt.title}</span>
              <span
                className={
                  'tpm-card__tag' + (opt.tagTone === 'loud' ? ' tpm-card__tag--loud' : '')
                }
              >
                {opt.tag}
              </span>
              <p className="tpm-card__desc">{opt.desc}</p>
            </div>
            <div className="tpm-card__preview">
              <MiniTrade variantClass={opt.cls} />
            </div>
          </article>
        ))}
      </div>

      <p className="tpm-note">
        <strong>Suggestion:</strong> Option B matches Live Table / Points Feed
        with the least new vocabulary. D if you want Trades to echo the live
        face-off winner glass. Open via <code>?tradepills=1</code>.
      </p>
    </div>
  )
}
