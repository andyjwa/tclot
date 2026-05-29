/**
 * Last-5-GW cards row for the Player Detail Overview tab. Replaces the
 * earlier `MiniBars` chart — the chart was readable in mocks but cramped
 * under real layouts and dropped the *who* dimension. Each card shows
 * the opponent club crest, opp short code with a green/red home-vs-away
 * dot, and the points the player earned that GW in uniform brand-violet
 * (DNP rows render greyed with a `DNP` chip).
 *
 * Round-2 polish (per user feedback on `b46ac2e`):
 *   - drop the `2-1 W` team-result chip (low signal, busy);
 *   - drop pos/neg green/red on the points number — uniform brand
 *     violet so the focus stays on the *number*, not the colouring;
 *   - render Home/Away as a coloured dot beside the opp code, not an
 *     `H` / `A` letter.
 *
 * Production class prefix `pdetail-l5__*`. Same component renders on
 * desktop + portrait — outer container handles the 5-col layout.
 */

/**
 * Premier-League small (50px) crest URL — same path the in-page roster
 * fixture chips use; 50px is plenty for these 28-32px crest cards.
 */
function plOppCrestUrl(teamCode) {
  if (teamCode == null) return null
  const n = Number(teamCode)
  if (!Number.isFinite(n)) return null
  return `https://resources.premierleague.com/premierleague/badges/50/t${n}.png`
}

/**
 * @param {{
 *   cards: Array<{
 *     gw: number,
 *     opponentTeamId: number | null,
 *     home: boolean,
 *     score: string | null,
 *     result: 'W' | 'D' | 'L' | null,
 *     points: number | null,
 *     dnp: boolean,
 *     tone: 'pos' | 'neg' | 'neutral',
 *   }>,
 *   teamById: Map<number, object> | null | undefined,
 * }} props
 */
export function PlayerDetailLastFiveCards({ cards, teamById }) {
  if (!cards || cards.length === 0) return null
  return (
    <div className="pdetail-l5">
      {cards.map((c) => {
        const opp =
          c.opponentTeamId != null
            ? teamById?.get?.(c.opponentTeamId) ?? teamById?.[c.opponentTeamId] ?? null
            : null
        const oppShort = opp?.short_name ?? '???'
        const crestUrl = plOppCrestUrl(opp?.code)
        const haLabel = c.home ? 'home' : 'away'
        return (
          <div
            key={`${c.gw}-${c.opponentTeamId ?? 'na'}`}
            className={
              'pdetail-l5__card' +
              (c.dnp ? ' pdetail-l5__card--dnp' : '')
            }
            title={
              c.dnp
                ? `GW${c.gw} · ${oppShort} (${haLabel}) · DNP`
                : `GW${c.gw} · ${oppShort} (${haLabel}) · ${c.points ?? 0} pts`
            }
          >
            <div className="pdetail-l5__gw">GW{c.gw}</div>
            <div className="pdetail-l5__crest" aria-hidden>
              {crestUrl ? (
                <img src={crestUrl} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="pdetail-l5__crest-fallback">{oppShort.slice(0, 3)}</span>
              )}
            </div>
            <div className="pdetail-l5__opp">
              <span>{oppShort}</span>
              <span
                className={
                  'pdetail-l5__ha-dot' +
                  (c.home ? ' pdetail-l5__ha-dot--home' : ' pdetail-l5__ha-dot--away')
                }
                aria-label={c.home ? 'Home' : 'Away'}
                title={c.home ? 'Home' : 'Away'}
              />
            </div>
            {c.dnp ? (
              <div className="pdetail-l5__dnp">DNP</div>
            ) : (
              <div className="pdetail-l5__pts">{c.points ?? 0}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
