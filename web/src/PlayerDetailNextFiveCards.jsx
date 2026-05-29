/**
 * Next-5-fixture cards row for the Player Detail Overview tab. Mirrors
 * the visual treatment of `PlayerDetailLastFiveCards` (same 5-col grid,
 * same card padding + crest size + GW eyebrow) so the two strips read
 * as a continuous timeline of past + future GWs:
 *
 *   GW   |   crest   |   opp · home/away dot
 *
 * No FDR pip, no points field. Future fixtures: points don't exist yet
 * and the user explicitly dropped FDR from default visible signals
 * ("FDR isn't needed as a default"). The blank lower half of the card
 * keeps height parity with `pdetail-l5__card` so the two rows align.
 *
 * Production class prefix `pdetail-n5__*`. Hidden by the parent when
 * `rows.length === 0` (e.g. season-end after GW 38).
 */

/** PL 50-px transparent crest URL — same family used by the in-page roster chips. */
function plOppCrestUrl(teamCode) {
  if (teamCode == null) return null
  const n = Number(teamCode)
  if (!Number.isFinite(n)) return null
  return `https://resources.premierleague.com/premierleague/badges/50/t${n}.png`
}

/**
 * @param {{
 *   rows: Array<{
 *     gw: number,
 *     teamId: number,
 *     home: boolean,
 *     difficulty: 1 | 2 | 3 | 4 | 5,
 *   }>,
 *   teamById: Map<number, object> | null | undefined,
 * }} props
 */
export function PlayerDetailNextFiveCards({ rows, teamById }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="pdetail-l5 pdetail-n5">
      {rows.map((r) => {
        const opp =
          r.teamId != null
            ? teamById?.get?.(r.teamId) ?? teamById?.[r.teamId] ?? null
            : null
        const oppShort = opp?.short_name ?? '???'
        const crestUrl = plOppCrestUrl(opp?.code)
        const haLabel = r.home ? 'home' : 'away'
        return (
          <div
            key={`${r.gw}-${r.teamId}`}
            className="pdetail-l5__card pdetail-n5__card"
            title={`GW${r.gw} · ${oppShort} (${haLabel})`}
          >
            <div className="pdetail-l5__gw">GW{r.gw}</div>
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
                  (r.home ? ' pdetail-l5__ha-dot--home' : ' pdetail-l5__ha-dot--away')
                }
                aria-label={r.home ? 'Home' : 'Away'}
                title={r.home ? 'Home' : 'Away'}
              />
            </div>
            <div className="pdetail-n5__spacer" aria-hidden />
          </div>
        )
      })}
    </div>
  )
}
