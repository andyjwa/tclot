import { useMemo } from 'react'
import {
  CompareClubSourcePill,
  ComparePlayerPill,
  ComparePlayerSearch,
  StatsColumnsPill,
} from './playersFilterPills.jsx'
import { fplElementWebName, fplElementFullName } from './fplElementNames.js'
import { POS_LABEL } from './playersWireList.js'
import { lastNHistoryRows } from './playerDetailDerivations.js'
import { PlayerDetailMiniBars } from './PlayerDetailMiniBars.jsx'

/**
 * Same crest URL helper as `PlayerDetailHero` but smaller — these crests
 * render at 14-32 px so the 50-px PL CDN size is plenty (and matches the
 * legacy `PlayerWireHero` 50-px treatment, so cache hit rates stay high).
 */
function plCrestUrl(teamCode) {
  if (teamCode == null) return null
  const n = Number(teamCode)
  if (!Number.isFinite(n)) return null
  return `https://resources.premierleague.com/premierleague/badges/50/t${n}.png`
}

/** Parse the leading numeric portion from a pill value (e.g. "23" → 23, "8.0" → 8). */
function pillNumeric(v) {
  if (v == null) return null
  const m = String(v).match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/**
 * Crest <img> with graceful fallback to the team short name pill, mirrors
 * the same behaviour as `PlayerDetailHero.CrestImg`. Inlined here so the
 * compare module stays self-contained.
 */
function CrestSlot({ teamCode, fallback, className = '', size = 32 }) {
  const url = plCrestUrl(teamCode)
  return (
    <span
      className={className || 'pcompare__crest'}
      aria-hidden
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="pcompare__crest-fallback">{fallback ?? '?'}</span>
      )}
    </span>
  )
}

function CloseIcon() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </svg>
  )
}

function BackChevron() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18 L9 12 L15 6" />
    </svg>
  )
}

/** Last-5-GW points array for the form mini-bars. */
function last5PtsFromPayload(payload) {
  const history = Array.isArray(payload?.history) ? payload.history : []
  const last5 = lastNHistoryRows(history, 5)
  return last5.map((h) => Number(h?.total_points) || 0)
}

/**
 * Player Compare flow — port of locked Mockup `ComparePortraitStacked`
 * (mobile) and `CompareDesktop` (desktop). Reuses the existing data hooks
 * (`compareSource`, `compareSearchOptions`, `compareSquadOptions`,
 * `benchId`, `comparePayload`, etc.) — only the rendering layout changes.
 *
 * Header row contains the small `‹` back chevron, the "Compare" title,
 * and a `X of 2` count. Below: a chip strip with player A and player B
 * (or an "Add player" affordance when B is empty) plus the existing
 * source / stats pills as a secondary control row. The body switches on
 * viewport: portrait uses a stacked single-column layout with a 4-column
 * `Stat · A · B · Δ` table; desktop renders the two players side-by-side
 * with their own stat columns and form bars.
 *
 * @param {{
 *   primaryEl: object,
 *   primaryPayload: object | null,
 *   primaryPills: { k: string, v: string }[],
 *   compareEl: object | null,
 *   comparePayload: object | null,
 *   comparePills: { k: string, v: string }[],
 *   teamById: Map<number, object>,
 *   onClose: () => void,
 *   onClearCompare: () => void,
 *   benchId: number | null,
 *   onBenchChange: (id: number | null) => void,
 *   onSearchBenchSelect: (id: number | null) => void,
 *   compareSource: any,
 *   onCompareSourceChange: (source: any) => void,
 *   compareSearchOptions: any[],
 *   compareSquadOptions: any[],
 *   teamsForFormSelect: any[],
 *   plClubs: any[],
 *   logoMap: Record<string, string>,
 *   kitIndexByEntry: Record<number, number>,
 *   detailStatIds: string[],
 *   onDetailStatChange: (ids: string[]) => void,
 *   detailPositionFilter: string,
 *   detailStatMax: number,
 *   portrait: boolean,
 *   mobileLayout: boolean,
 * }} props
 */
export function PlayerCompareView({
  primaryEl,
  primaryPayload,
  primaryPills,
  compareEl,
  comparePayload,
  comparePills,
  teamById,
  onClose,
  onClearCompare,
  benchId,
  onBenchChange,
  onSearchBenchSelect,
  compareSource,
  onCompareSourceChange,
  compareSearchOptions,
  compareSquadOptions,
  teamsForFormSelect,
  plClubs,
  logoMap,
  kitIndexByEntry,
  detailStatIds,
  onDetailStatChange,
  detailPositionFilter,
  detailStatMax,
  portrait,
  mobileLayout,
}) {
  const teamA = primaryEl?.team != null ? teamById?.get?.(primaryEl.team) ?? null : null
  const teamB = compareEl?.team != null ? teamById?.get?.(compareEl.team) ?? null : null

  const posA = POS_LABEL[primaryEl?.element_type] ?? '?'
  const posB = compareEl ? POS_LABEL[compareEl.element_type] ?? '?' : null

  const nameAFull = fplElementFullName(primaryEl, primaryEl?.id)
  const nameAWeb = fplElementWebName(primaryEl, primaryEl?.id)
  const nameBFull = compareEl ? fplElementFullName(compareEl, compareEl.id) : null
  const nameBWeb = compareEl ? fplElementWebName(compareEl, compareEl.id) : null

  /**
   * Stat-table rows: align entries from `primaryPills` and `comparePills`
   * by `k`. Skip the "Pts" anchor (it's already implicit in both heroes
   * via `total_points` styling). Numeric Δ falls back to `null` when
   * either side is non-numeric (e.g. position abbreviation).
   */
  const statRows = useMemo(() => {
    const rows = []
    if (!Array.isArray(primaryPills)) return rows
    for (const a of primaryPills) {
      const b = compareEl
        ? (Array.isArray(comparePills) ? comparePills.find((p) => p.k === a.k) : null)
        : null
      const na = pillNumeric(a.v)
      const nb = b ? pillNumeric(b.v) : null
      let delta = null
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        delta = Number((na - nb).toFixed(2))
      }
      rows.push({ k: a.k, va: a.v ?? '—', vb: b?.v ?? '—', na, nb, delta })
    }
    return rows
  }, [primaryPills, comparePills, compareEl])

  const last5A = last5PtsFromPayload(primaryPayload)
  const last5B = comparePayload ? last5PtsFromPayload(comparePayload) : []
  const formMaxA = last5A.length > 0 ? Math.max(18, ...last5A) : 18
  const formMaxB = last5B.length > 0 ? Math.max(18, ...last5B) : 18

  const compareCount = compareEl ? 2 : 1
  const showPickers = !compareEl

  const Header = (
    <div className="pcompare__h">
      <button
        type="button"
        className="pcompare__back"
        onClick={onClose}
        aria-label="Back to player detail"
      >
        <BackChevron />
      </button>
      <span className="pcompare__h-title">Compare</span>
      <span className="pcompare__h-meta">{compareCount} of 2</span>
    </div>
  )

  const Chips = (
    <div className="pcompare__chips">
      <span className="pcompare__chip pcompare__chip--a" title={nameAFull}>
        <CrestSlot teamCode={teamA?.code} fallback={teamA?.short_name} size={14} className="pcompare__chip-crest" />
        <span className="pcompare__chip-name">{nameAWeb}</span>
        <button
          type="button"
          className="pcompare__chip-x"
          onClick={onClose}
          aria-label="Close compare"
        >
          <CloseIcon />
        </button>
      </span>
      {compareEl ? (
        <span className="pcompare__chip pcompare__chip--b" title={nameBFull}>
          <CrestSlot teamCode={teamB?.code} fallback={teamB?.short_name} size={14} className="pcompare__chip-crest" />
          <span className="pcompare__chip-name">{nameBWeb}</span>
          <button
            type="button"
            className="pcompare__chip-x"
            onClick={onClearCompare}
            aria-label="Remove compare player"
          >
            <CloseIcon />
          </button>
        </span>
      ) : (
        <span className="pcompare__chip pcompare__chip--add">
          <span className="pcompare__chip-add-plus" aria-hidden>+</span>
          <span className="pcompare__chip-add-label">Add player</span>
        </span>
      )}
    </div>
  )

  const Pickers = (
    <div className="pcompare__pickers">
      {compareEl ? (
        <ComparePlayerPill
          options={compareSource ? compareSquadOptions : compareSearchOptions}
          selectedId={benchId}
          onSelect={onBenchChange}
          positionLabel={posB}
          displayName={mobileLayout ? nameBWeb : nameBFull}
        />
      ) : (
        <ComparePlayerSearch
          options={compareSearchOptions}
          selectedId={benchId}
          onSelect={onSearchBenchSelect}
          placeholder="Find a player…"
          positionLabel={posB ?? posA}
          compact={mobileLayout}
        />
      )}
      <CompareClubSourcePill
        fantasyTeams={teamsForFormSelect}
        plClubs={plClubs}
        selected={compareSource}
        onSelect={onCompareSourceChange}
        logoMap={logoMap}
        kitIndexByEntry={kitIndexByEntry}
        compact={mobileLayout}
      />
      <StatsColumnsPill
        selectedIds={detailStatIds}
        onChange={onDetailStatChange}
        positionFilter={detailPositionFilter}
        maxStatColumns={detailStatMax}
        compact={mobileLayout}
      />
    </div>
  )

  if (portrait) {
    return (
      <div className="pcompare-host pcompare-host--portrait">
        {Header}
        {Chips}
        {Pickers}

        <div className="pcompare-p__hero-row">
          <span className="pcompare-p__hero-letter pcompare-p__hero-letter--a">A</span>
          <CrestSlot teamCode={teamA?.code} fallback={teamA?.short_name} className="pcompare-p__hero-crest" size={32} />
          <div className="pcompare-p__hero-body">
            <div className="pcompare-p__hero-name" title={nameAFull}>{nameAWeb}</div>
            <div className="pcompare-p__hero-meta">
              <span className="pcompare__pos">{posA}</span>
              {teamA?.name ? <span>{teamA.name}</span> : null}
            </div>
          </div>
        </div>

        {compareEl ? (
          <div className="pcompare-p__hero-row">
            <span className="pcompare-p__hero-letter pcompare-p__hero-letter--b">B</span>
            <CrestSlot teamCode={teamB?.code} fallback={teamB?.short_name} className="pcompare-p__hero-crest" size={32} />
            <div className="pcompare-p__hero-body">
              <div className="pcompare-p__hero-name" title={nameBFull}>{nameBWeb}</div>
              <div className="pcompare-p__hero-meta">
                <span className="pcompare__pos">{posB}</span>
                {teamB?.name ? <span>{teamB.name}</span> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="pcompare-p__empty">
            Search for a second player to compare side-by-side.
          </div>
        )}

        {compareEl ? (
          <>
            <div className="pcompare-p__th">
              <span>Stat</span>
              <span className="pcompare-p__th-a">A</span>
              <span className="pcompare-p__th-b">B</span>
              <span className="pcompare-p__th-d">Δ</span>
            </div>
            <div className="pcompare-p__rows">
              {statRows.map((r) => {
                const bothNum = Number.isFinite(r.na) && Number.isFinite(r.nb)
                const winA = bothNum && r.na > r.nb
                const winB = bothNum && r.nb > r.na
                const sign = !bothNum ? '' : r.delta > 0 ? '+' : r.delta < 0 ? '−' : '±'
                return (
                  <div className="pcompare-p__row" key={r.k}>
                    <span className="pcompare-p__k">{r.k}</span>
                    <span
                      className={
                        'pcompare-p__v pcompare-p__v--a' + (winA ? ' is-winner' : '')
                      }
                    >
                      {r.va}
                    </span>
                    <span
                      className={
                        'pcompare-p__v pcompare-p__v--b' + (winB ? ' is-winner' : '')
                      }
                    >
                      {r.vb}
                    </span>
                    <span
                      className={
                        'pcompare-p__d' +
                        (bothNum && r.delta > 0
                          ? ' pcompare-p__d--pos'
                          : bothNum && r.delta < 0
                            ? ' pcompare-p__d--neg'
                            : '')
                      }
                    >
                      {bothNum ? `${sign}${Math.abs(r.delta)}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="pcompare-p__section-h">Form (last 5 GW)</div>
            <div className="pcompare-p__form-row">
              <span className="pcompare-p__form-letter pcompare-p__hero-letter--a">A</span>
              <PlayerDetailMiniBars
                values={last5A}
                max={formMaxA}
                width={280}
                height={48}
                accent="brand"
              />
            </div>
            <div className="pcompare-p__form-row">
              <span className="pcompare-p__form-letter pcompare-p__hero-letter--b">B</span>
              <PlayerDetailMiniBars
                values={last5B}
                max={formMaxB}
                width={280}
                height={48}
                accent="brand"
              />
            </div>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="pcompare-host">
      {Header}
      {Chips}
      {Pickers}

      <div className="pcompare-d__cols">
        {[
          {
            letter: 'A',
            el: primaryEl,
            team: teamA,
            name: nameAWeb,
            full: nameAFull,
            pos: posA,
            pills: primaryPills,
            last5: last5A,
            max: formMaxA,
          },
          ...(compareEl
            ? [{
                letter: 'B',
                el: compareEl,
                team: teamB,
                name: nameBWeb,
                full: nameBFull,
                pos: posB,
                pills: comparePills,
                last5: last5B,
                max: formMaxB,
              }]
            : []),
        ].map((p) => (
          <div className="pcompare-d__col" key={p.letter}>
            <div className="pcompare-d__player">
              <CrestSlot teamCode={p.team?.code} fallback={p.team?.short_name} className="pcompare-d__player-crest" size={48} />
              <div className="pcompare-d__player-body">
                <div className="pcompare-d__player-name" title={p.full}>{p.name}</div>
                <div className="pcompare-d__player-meta">
                  <span className="pcompare__pos">{p.pos}</span>
                  {p.team?.name ? <span>{p.team.name}</span> : null}
                </div>
              </div>
              <span
                className={`pcompare-d__player-letter pcompare-d__player-letter--${p.letter.toLowerCase()}`}
              >
                {p.letter}
              </span>
            </div>

            <div className="pcompare-d__stats">
              {(Array.isArray(p.pills) ? p.pills : []).map((s, i) => {
                const otherPills =
                  p.letter === 'A' ? comparePills : primaryPills
                const otherV = Array.isArray(otherPills)
                  ? otherPills.find((q) => q.k === s.k)?.v ?? null
                  : null
                const myN = pillNumeric(s.v)
                const otherN = pillNumeric(otherV)
                const isWinner = Number.isFinite(myN) && Number.isFinite(otherN) && myN > otherN
                return (
                  <div
                    className={
                      'pcompare-d__stat' + (isWinner ? ' pcompare-d__stat--winner' : '')
                    }
                    key={`${s.k}-${i}`}
                  >
                    <span className="pcompare-d__stat-k">{s.k}</span>
                    <span className="pcompare-d__stat-v">
                      {isWinner ? <span className="pcompare-d__stat-up">▲</span> : null}
                      {s.v ?? '—'}
                    </span>
                  </div>
                )
              })}
              {p.last5.length > 0 ? (
                <div className="pcompare-d__stat pcompare-d__stat--form">
                  <span className="pcompare-d__stat-k">Form (last 5)</span>
                  <span className="pcompare-d__stat-bars">
                    <PlayerDetailMiniBars
                      values={p.last5}
                      max={p.max}
                      width={200}
                      height={48}
                      accent="brand"
                    />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {showPickers ? (
          <div className="pcompare-d__col pcompare-d__col--empty">
            <div className="pcompare-d__empty">
              <span className="pcompare-d__empty-plus" aria-hidden>+</span>
              <span>Search or pick a squad to add a second player</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
