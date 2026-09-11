import { useCallback, useEffect, useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { lastWordTeamName, standingsMobileTeamName } from './teamNameUtils.js'
import {
  describeBet,
  describeBetCompact,
  PLAYER_MARKET_KINDS,
  SEASON_PLACE_KINDS,
} from './bookieBetLabel.js'
import {
  bookieEnabled,
  fetchBookieState,
  loadBookieSession,
  saveBookieSession,
  clearBookieSession,
  registerBookie,
  loginBookie,
  placeBookieBet,
  fetchCashoutQuotes,
  cashoutBookieBet,
} from './bookieApi.js'
import { SideBetsBand } from './SideBets.jsx'
import { decimalOddsToFraction } from './oddsFormat.js'
import { historyOpponentMetaForGw, loadLeagueFixtures } from './playerGwHistory.js'
import { fetchLeagueJsonFile } from './playersBenchShared.js'
import { highlightSettledOnLiveBoard, liveBoardGameweek, liveBoardTickets } from './bookieLiveBoard.js'
import {
  enrichLeaderboardRows,
  nextLeaderboardSort,
  sortLeaderboardRows,
  weeklyBetNet,
  weeklyWinnerGroups,
} from './bookieLeaderboardStats.js'
import './BookieView.css'

/** "Fri 28 Aug, 18:30" in the viewer's locale. */
function fmtDeadline(iso) {
  const t = Date.parse(iso ?? '')
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Coarse countdown for an open market: "2d 4h", "3h 10m", "12m". */
function fmtCountdown(iso, nowMs) {
  const t = Date.parse(iso ?? '')
  if (!Number.isFinite(t)) return null
  const ms = t - nowMs
  if (ms <= 0) return null
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

function fmtCoins(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString()
}

/**
 * Traditional fractional price for display — markets are generated on the
 * fractional ladder (build-bookie-markets.mjs snaps them), so this is exact.
 * Decimal is kept as a tooltip for anyone who thinks in multipliers.
 */
function fmtOdds(odds) {
  return decimalOddsToFraction(odds) ?? Number(odds).toFixed(2)
}

function fmtNet(n) {
  const v = Number(n) || 0
  return `${v > 0 ? '+' : ''}${v.toLocaleString()}`
}

function betReturnTone(status) {
  if (status === 'won') return 'won'
  if (status === 'lost') return 'lost'
  if (status === 'cashed_out') return 'cashed'
  if (status === 'void') return 'void'
  return 'open'
}

/**
 * What a ticket is worth in the Return column: still running means the
 * potential payout, settled means whatever it actually paid.
 */
function betReturnValue(bet) {
  if (bet.status === 'open' || bet.status == null) {
    return Math.round(Number(bet.stake) * Number(bet.odds))
  }
  if (bet.status === 'won' || bet.status === 'cashed_out') return Number(bet.payout) || 0
  if (bet.status === 'void') return Number(bet.stake) || 0
  return 0
}

function betReturnLabel(bet) {
  if (bet.status === 'lost') return '—'
  return fmtCoins(betReturnValue(bet))
}

function betRowClassName(bet, liveGw, marketById) {
  const market = marketById?.get(Number(bet.market_id))
  const row = {
    ...bet,
    kind: bet.kind || market?.kind,
    gw: bet.gw ?? market?.gw,
  }
  const status = row.status && row.status !== 'open' ? ` bookie-bet--${row.status}` : ''
  const settled = highlightSettledOnLiveBoard(row, liveGw) ? ' bookie-bet--settled' : ''
  return `bookie-bet${status}${settled}`
}

function BetColHead({ cashout = false }) {
  return (
    <li className="bookie-bet bookie-bet--head" aria-hidden="true">
      <span className="bookie-bet__desc" />
      <span className="bookie-bet__col">Odds</span>
      <span className="bookie-bet__col">Wager</span>
      <span className="bookie-bet__col">Return</span>
      {cashout ? <span className="bookie-bet__col">Cash out</span> : null}
    </li>
  )
}

/** Footer row totalling the wager and return columns for a list of tickets. */
function BetTotals({ bets }) {
  const staked = bets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0)
  const returns = bets.reduce((sum, b) => sum + betReturnValue(b), 0)
  return (
    <li className="bookie-bet bookie-bet--total">
      <span className="bookie-bet__desc">Total</span>
      <span className="bookie-bet__col" />
      <span className="bookie-bet__pill bookie-bet__pill--wager tabular">{fmtCoins(staked)}</span>
      <span className="bookie-bet__pill bookie-bet__pill--return bookie-bet__pill--open tabular">
        {fmtCoins(returns)}
      </span>
    </li>
  )
}

function BetTicketFigures({ bet }) {
  const tone = betReturnTone(bet.status)
  return (
    <>
      <span
        className="bookie-bet__col bookie-bet__col--odds tabular"
        title={`decimal ${Number(bet.odds).toFixed(2)}`}
      >
        {fmtOdds(bet.odds)}
      </span>
      <span className="bookie-bet__pill bookie-bet__pill--wager tabular">{fmtCoins(bet.stake)}</span>
      <span className={`bookie-bet__pill bookie-bet__pill--return bookie-bet__pill--${tone} tabular`}>
        {betReturnLabel(bet)}
      </span>
    </>
  )
}

/** Same grid as live bets, but P/L is green/red text instead of a pill. */
function WeeklyWinnerFigures({ bet }) {
  const net = weeklyBetNet(bet)
  return (
    <>
      <span
        className="bookie-bet__col bookie-bet__col--odds tabular"
        title={`decimal ${Number(bet.odds).toFixed(2)}`}
      >
        {fmtOdds(bet.odds)}
      </span>
      <span className="bookie-bet__col bookie-winners__fig tabular">{fmtCoins(bet.stake)}</span>
      <span
        className={
          'bookie-bet__col tabular ' +
          (net >= 0 ? 'bookie-winners__fig--up' : 'bookie-winners__fig--down')
        }
      >
        {fmtNet(net)}
      </span>
    </>
  )
}

/**
 * The Bookie tab — fake-money betting against the site's own model.
 *
 * Everything financial lives in the bookie Worker (web/workers/bookie/);
 * this view is a thin client: pick your team + PIN once, then back weekly
 * H2H matchups and the outright champion with coins. Odds shown are the
 * decimal prices frozen into each market, so stake × odds is exactly what
 * a winning ticket pays.
 */
export function BookieView({ teamLogoMap = {}, kitIndexByEntry }) {
  const enabled = bookieEnabled()
  const [session, setSession] = useState(() => (enabled ? loadBookieSession() : null))
  const [state, setState] = useState(null)
  const [failed, setFailed] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  /** { marketId, selection, label, odds } while the slip is open. */
  const [slip, setSlip] = useState(null)
  /** betId → current cash-out offer in Clotcoins (open bets only). */
  const [cashoutQuotes, setCashoutQuotes] = useState(() => new Map())

  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    setFailed(false)
    fetchBookieState(session?.token ?? null)
      .then((json) => {
        if (!alive) return
        setState(json)
        // A token the Worker no longer honors (season rolled, secret rotated)
        // comes back without `me` — drop it so the login card reappears.
        if (session && !json?.me) {
          clearBookieSession()
          setSession(null)
        }
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    // Cash-out offers ride along with every state refresh; a failure just
    // means no buttons this round, never a broken tab.
    if (session?.token) {
      fetchCashoutQuotes(session.token)
        .then((json) => {
          if (!alive) return
          setCashoutQuotes(
            new Map((json?.quotes ?? []).map((q) => [Number(q.betId), Number(q.value)])),
          )
        })
        .catch(() => {
          if (alive) setCashoutQuotes(new Map())
        })
    } else {
      setCashoutQuotes(new Map())
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.token, refreshNonce])

  const onLoggedIn = useCallback((auth) => {
    const next = { token: auth.token, entryId: auth.entryId, name: auth.name }
    saveBookieSession(next)
    setSession(next)
  }, [])

  const onLogout = useCallback(() => {
    clearBookieSession()
    setSession(null)
    setSlip(null)
  }, [])

  if (!enabled) {
    return (
      <section className="tile tile--compact" aria-label="Bookie">
        <h2 className="tile-title tile-title--sm">TCLOT Bookie</h2>
        <p className="bookie__note">
          The bookie backend is not configured for this deploy. Deploy the Worker in{' '}
          <code>web/workers/bookie/</code> and set <code>VITE_BOOKIE_API_URL</code> to its
          URL at build time (see <code>DEPLOY.md</code>).
        </p>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="tile tile--compact" aria-label="Bookie">
        <h2 className="tile-title tile-title--sm">TCLOT Bookie</h2>
        <p className="bookie__note">The bookie is unreachable right now — try again shortly.</p>
      </section>
    )
  }

  if (!state) {
    return (
      <section className="tile tile--compact" aria-label="Bookie">
        <h2 className="tile-title tile-title--sm">TCLOT Bookie</h2>
        <p className="bookie__note">Opening the book…</p>
      </section>
    )
  }

  const me = state.me ?? null
  const markets = Array.isArray(state.markets) ? state.markets : []
  const h2hMarkets = markets.filter((m) => m.kind === 'h2h')
  const placeMarkets = markets.filter((m) => SEASON_PLACE_KINDS.includes(m.kind))
  const rosterMarket =
    placeMarkets.find((m) => m.kind === 'outright') ?? placeMarkets[0] ?? null
  const openGw = h2hMarkets.find((m) => m.open)?.gw ?? null
  const weeklyOpen = openGw != null ? h2hMarkets.filter((m) => m.gw === openGw) : []
  const playerOpen =
    openGw != null
      ? markets.filter((m) => PLAYER_MARKET_KINDS.includes(m.kind) && m.gw === openGw && m.open)
      : []
  const nameByEntry = new Map(
    (state.leaderboard ?? []).map((u) => [Number(u.entryId), u.name]),
  )
  for (const m of placeMarkets) {
    for (const s of m.payload?.selections ?? []) {
      if (!nameByEntry.has(Number(s.entryId))) nameByEntry.set(Number(s.entryId), s.name)
    }
  }

  return (
    <div className="dashboard-stack">
      <BookieHeader me={me} state={state} onLogout={onLogout} />

      {!me ? (
        <BookieLogin
          roster={rosterMarket?.payload?.selections ?? []}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          onLoggedIn={onLoggedIn}
        />
      ) : null}

      <WeeklyMarkets
        gw={openGw}
        markets={weeklyOpen}
        playerMarkets={playerOpen}
        me={me}
        slip={slip}
        onPick={setSlip}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
        sideBets={state.sideBets ?? []}
        sideMe={me}
        sideToken={session?.token ?? null}
        onSideChanged={refresh}
        sideMinStake={state.sideMinStake}
        sideMaxStake={state.sideMaxStake}
        sideSentenceMin={state.sideSentenceMin}
        sideSentenceMax={state.sideSentenceMax}
        roster={[...nameByEntry.entries()].map(([entryId, name]) => ({ entryId, name }))}
      />

      {slip && me ? (
        <BetSlip
          slip={slip}
          me={me}
          minStake={state.minStake ?? 10}
          token={session?.token}
          onClose={() => setSlip(null)}
          onPlaced={() => {
            setSlip(null)
            refresh()
          }}
        />
      ) : null}

      {placeMarkets.length > 0 ? (
        <SeasonPlaceBoard
          markets={placeMarkets}
          me={me}
          onPick={setSlip}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : null}

      <section className="tile tile--compact" aria-label="Side bets">
        <SideBetsBand
          bets={state.sideBets ?? []}
          roster={[...nameByEntry.entries()].map(([entryId, name]) => ({ entryId, name }))}
          me={me}
          token={session?.token ?? null}
          onChanged={refresh}
          minStake={state.sideMinStake}
          maxStake={state.sideMaxStake}
          sentenceMin={state.sideSentenceMin}
          sentenceMax={state.sideSentenceMax}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          tone="bookie"
        />
      </section>

      {me ? (
        <MyBets
          me={me}
          markets={markets}
          nameByEntry={nameByEntry}
          cashoutQuotes={cashoutQuotes}
          token={session?.token}
          onCashedOut={refresh}
        />
      ) : null}

      <LiveBets
        state={state}
        me={me}
        markets={markets}
        nameByEntry={nameByEntry}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />

      <BookieLeaderboards
        state={state}
        me={me}
        nameByEntry={nameByEntry}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />

      <section className="tile tile--compact" aria-label="How the bookie works">
        <h3 className="bookie__method-title">House rules</h3>
        <p className="bookie__note">
          Every manager starts the season with {fmtCoins(state.startingBalance ?? 1000)}{' '}
          Clotcoins — the official TCLOT currency: completely fake, worthless, and worth
          fighting over. Odds are set by the same model behind the Season Predictions tab,
          with a small house margin, and quoted as traditional fractions. Weekly matchup
          and player-special markets close at the FPL deadline — player specials pool both
          squads, pay every scorer (or the top point scorer, dead heats all paying), and
          refund any pick who never gets on the pitch. Champion, Titan, Minnow and
          last-place boards reprice after every gameweek but your ticket keeps the odds
          you took.
          Every ticket is public — the live bets board shows what everyone has riding
          this week. Bets settle as soon as the football finishes, stay on that board
          (green row) until the next gameweek's markets open, and a{' '}
          {fmtCoins(state.weeklyStipend ?? 50)}-Clotcoin stipend lands after
          each settled gameweek only if your bankroll has fallen below{' '}
          {fmtCoins(state.stipendFloor ?? 250)},           so going bust is embarrassing,
          not terminal. A side bet is just two of you: equal stakes, no odds, and the
          pot only moves when the other person confirms. Open tickets carry a
          cash-out offer — what your position is worth right now, minus the house's cut.
          Once the gameweek kicks off the offer tracks the live scores, so when your long
          shot is 20 points up the bookie will dangle a tidy guaranteed profit in front of
          you and quietly hope you take it.
        </p>
      </section>
    </div>
  )
}

function BookieHeader({ me, state, onLogout }) {
  return (
    <section className="tile tile--compact bookie-header" aria-label="Bookie account">
      <div className="tile-head-row tile-head-row--tight">
        <h2 className="tile-title tile-title--sm">TCLOT Bookie</h2>
        {state.season ? <span className="bookie-header__season tabular">{state.season}</span> : null}
      </div>
      {me ? (
        <div className="bookie-header__account">
          <span className="bookie-header__who">
            Betting as <strong>{standingsMobileTeamName(me.name)}</strong>
          </span>
          <span className="bookie-header__balance tabular" title="Clotcoin balance">
            {fmtCoins(me.balance)} Clotcoins
          </span>
          <button type="button" className="bookie-header__logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      ) : null}
    </section>
  )
}

function BookieLogin({ roster, teamLogoMap, kitIndexByEntry, onLoggedIn }) {
  const [entryId, setEntryId] = useState(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (mode) => {
    if (entryId == null || !/^\d{4,8}$/.test(pin)) {
      setError('Pick your team and enter a 4–8 digit PIN.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const auth =
        mode === 'register' ? await registerBookie(entryId, pin) : await loginBookie(entryId, pin)
      onLoggedIn(auth)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tile tile--compact bookie-login" aria-label="Claim your team">
      <h3 className="bookie__section-title">Who are you?</h3>
      {roster.length === 0 ? (
        <p className="bookie__note">
          The book has no roster yet — markets open once the site deploys with the next
          gameweek's sheet.
        </p>
      ) : (
        <>
          <div className="bookie-login__pick-row">
            {entryId != null ? (
              <TeamAvatar
                entryId={entryId}
                name={roster.find((t) => Number(t.entryId) === entryId)?.name ?? ''}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            ) : null}
            <select
              className="bookie-login__select"
              value={entryId ?? ''}
              onChange={(e) => setEntryId(e.target.value ? Number(e.target.value) : null)}
              aria-label="Your team"
            >
              <option value="" disabled>
                Pick your team…
              </option>
              {roster.map((t) => (
                <option key={t.entryId} value={t.entryId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="bookie-login__pin-row">
            <input
              className="bookie-login__pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN (4–8 digits)"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              aria-label="PIN"
            />
            <button
              type="button"
              className="bookie__btn bookie__btn--primary"
              disabled={busy}
              onClick={() => submit('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className="bookie__btn"
              disabled={busy}
              onClick={() => submit('register')}
            >
              First time — claim team
            </button>
          </div>
          <p className="bookie__note bookie__note--small">
            First visit: pick your team, choose a PIN, hit “claim team”. The PIN stops your
            rivals betting your bankroll on last place — it is honor-system security, not
            banking security.
          </p>
          {error ? <p className="bookie__error" role="alert">{error}</p> : null}
        </>
      )}
    </section>
  )
}

function OddsButton({ label, odds, active, disabled, onClick }) {
  return (
    <button
      type="button"
      className={'bookie-odds-btn' + (active ? ' bookie-odds-btn--active' : '')}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="bookie-odds-btn__label">{label}</span>
      <span className="bookie-odds-btn__odds tabular" title={`decimal ${Number(odds).toFixed(2)}`}>
        {fmtOdds(odds)}
      </span>
    </button>
  )
}

/**
 * A tile whose whole body folds behind its title row. Pass `open` for a
 * section that should start expanded (fixtures inside still load collapsed).
 */
function FoldTile({ ariaLabel, title, meta, open = false, children }) {
  return (
    <section className="tile tile--compact" aria-label={ariaLabel}>
      <details className="bookie-fold" open={open || undefined}>
        <summary className="bookie-fold__summary">
          <h3 className="bookie__section-title bookie-fold__title">{title}</h3>
          {meta ? <span className="bookie__deadline tabular">{meta}</span> : null}
        </summary>
        {children}
      </details>
    </section>
  )
}

/** @type {Promise<object | null> | null} */
let fplMiniLoad = null
function loadFplMini() {
  if (!fplMiniLoad) {
    fplMiniLoad = fetchLeagueJsonFile('fpl-mini.json').catch(() => null)
  }
  return fplMiniLoad
}

/**
 * PL club context for the player-special boards: element → club (badge) and
 * this gameweek's real fixture with home/away. Derived client-side from
 * fpl-mini.json + fixtures.json because an open market keeps the payload it
 * was ingested with — selections carry no club code or fixture fields.
 */
function usePlayerClubContext(active) {
  const [ctx, setCtx] = useState(null)
  useEffect(() => {
    if (!active || ctx) return undefined
    let alive = true
    Promise.all([loadFplMini(), loadLeagueFixtures()]).then(([mini, fixtures]) => {
      if (!alive || !mini) return
      setCtx({
        teamById: new Map((mini.teams ?? []).map((t) => [Number(t.id), t])),
        teamIdByElement: new Map(
          (mini.elements ?? []).map((e) => [Number(e.id), Number(e.team)]),
        ),
        fixtures: Array.isArray(fixtures) ? fixtures : [],
      })
    })
    return () => {
      alive = false
    }
  }, [active, ctx])
  return ctx
}

function WeeklyMarkets({
  gw,
  markets,
  playerMarkets,
  me,
  slip,
  onPick,
  teamLogoMap,
  kitIndexByEntry,
  sideBets = [],
  sideMe = null,
  sideToken = null,
  onSideChanged = null,
  sideMinStake = null,
  sideMaxStake = null,
  sideSentenceMin = null,
  sideSentenceMax = null,
  roster = [],
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  /** matchup "home-away" → its player-special boards, in kind order. */
  const boardsByMatch = useMemo(() => {
    const map = new Map()
    for (const kind of PLAYER_MARKET_KINDS) {
      for (const m of playerMarkets ?? []) {
        if (m.kind !== kind || !m.payload) continue
        const key = `${m.payload.homeEntryId}-${m.payload.awayEntryId}`
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(m)
      }
    }
    return map
  }, [playerMarkets])

  const clubCtx = usePlayerClubContext(boardsByMatch.size > 0)

  if (gw == null || markets.length === 0) {
    return (
      <section className="tile tile--compact" aria-label="Weekly markets">
        <h3 className="bookie__section-title">This week's matchups</h3>
        <p className="bookie__note">
          No open weekly market right now — the next gameweek's board opens when the site
          rebuilds after results are banked.
        </p>
      </section>
    )
  }

  const deadline = markets[0]?.closesAt
  const countdown = fmtCountdown(deadline, nowMs)
  const anySpecials = boardsByMatch.size > 0

  return (
    <FoldTile
      ariaLabel="Weekly markets"
      title={`GW${gw} matchups`}
      meta={countdown ? `closes in ${countdown}` : `closes ${fmtDeadline(deadline) ?? 'soon'}`}
      open
    >
      <div className="bookie-punters">
        {markets.map((m) => {
          const p = m.payload
          const home = standingsMobileTeamName(p.homeName)
          const away = standingsMobileTeamName(p.awayName)
          const matchLabel = `${home} v ${away}`
          const boards = boardsByMatch.get(`${p.homeEntryId}-${p.awayEntryId}`) ?? []
          const pickFor = (selection, label, odds) => () =>
            onPick({
              marketId: m.id,
              selection,
              label,
              odds,
              detail: `${matchLabel} · GW${gw}`,
            })
          const isActive = (selection) => slip?.marketId === m.id && slip?.selection === selection
          return (
            <details key={m.id} className="bookie-punter">
              <summary className="bookie-punter__summary">
                <span className="bookie-market__teams bookie-fixture__teams">
                  <span className="bookie-market__team">
                    <TeamAvatar
                      entryId={p.homeEntryId}
                      name={p.homeName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                    <span>{home}</span>
                  </span>
                  <span className="bookie-market__vs" aria-hidden>v</span>
                  <span className="bookie-market__team bookie-market__team--away">
                    <span>{away}</span>
                    <TeamAvatar
                      entryId={p.awayEntryId}
                      name={p.awayName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </span>
                </span>
              </summary>
              <div className="bookie-fixture__body">
                <div className="bookie-market__odds" role="group" aria-label="Match odds">
                  <OddsButton
                    label={home}
                    odds={p.odds.home}
                    active={isActive('home')}
                    disabled={!me || !m.open}
                    onClick={pickFor('home', `${home} to win`, p.odds.home)}
                  />
                  <OddsButton
                    label="Draw"
                    odds={p.odds.draw}
                    active={isActive('draw')}
                    disabled={!me || !m.open}
                    onClick={pickFor('draw', 'Draw', p.odds.draw)}
                  />
                  <OddsButton
                    label={away}
                    odds={p.odds.away}
                    active={isActive('away')}
                    disabled={!me || !m.open}
                    onClick={pickFor('away', `${away} to win`, p.odds.away)}
                  />
                </div>
                {boards.map((b) => (
                  <PlayerBoard
                    key={b.id}
                    market={b}
                    matchLabel={matchLabel}
                    clubCtx={clubCtx}
                    me={me}
                    slip={slip}
                    onPick={onPick}
                  />
                ))}
                <SideBetsBand
                  bets={sideBets}
                  homeId={p.homeEntryId}
                  awayId={p.awayEntryId}
                  homeName={p.homeName}
                  awayName={p.awayName}
                  roster={roster}
                  me={sideMe}
                  token={sideToken}
                  onChanged={onSideChanged}
                  minStake={sideMinStake}
                  maxStake={sideMaxStake}
                  sentenceMin={sideSentenceMin}
                  sentenceMax={sideSentenceMax}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  tone="fixture"
                  title="Side bet"
                  hideWhenEmpty
                />
              </div>
            </details>
          )
        })}
      </div>
      {anySpecials ? (
        <p className="bookie__note bookie__note--small">
          Player specials pool both squads. Anytime goalscorer pays on every player who
          scores — several tickets can win. Top point scorer pays the most draft points
          across both squads, dead heats all paying. A pick who never gets on the pitch is
          void: stake refunded.
        </p>
      ) : (
        <p className="bookie__note bookie__note--small">
          Player specials (anytime goalscorer and top point scorer) open under each
          fixture once the bookie has pulled this week's sheet. Refresh if they are
          missing.
        </p>
      )}
      {!me ? (
        <p className="bookie__note bookie__note--small">Log in above to back someone.</p>
      ) : null}
    </FoldTile>
  )
}

const PLAYER_BOARD_PREVIEW = 8

const PLAYER_BOARD_META = {
  scorer: {
    title: 'Anytime goalscorer',
    button: 'Scores',
    slipLabel: (name) => `${name} to score anytime`,
  },
  toppoints: {
    title: 'Top point scorer',
    button: 'Top',
    slipLabel: (name) => `${name} top point scorer`,
  },
}

/**
 * One player-special board (anytime goalscorer or top point scorer) inside a
 * matchup group: every pooled player with a price, longest odds hidden
 * behind a "full board" toggle so four matchups don't become a scroll cliff.
 *
 * Each row leads with the player's club badge and notes their real PL
 * fixture — "LIV (H)" — instead of spelling out the club, which the badge
 * already carries. Until clubCtx loads the meta falls back to the club code.
 */
function PlayerBoard({ market, matchLabel, clubCtx, me, slip, onPick }) {
  const [showAll, setShowAll] = useState(false)
  const meta = PLAYER_BOARD_META[market.kind]
  const p = market.payload
  const selections = p?.selections ?? []
  const visible = showAll ? selections : selections.slice(0, PLAYER_BOARD_PREVIEW)
  if (!meta || selections.length === 0) return null
  return (
    <div className="bookie-player-board">
      <h4 className="bookie-player-board__title">{meta.title}</h4>
      <ul className="bookie-outright bookie-player-board__list">
        {visible.map((s) => {
          const owner =
            Number(s.ownerEntryId) === Number(p.homeEntryId) ? p.homeName : p.awayName
          const active =
            slip?.marketId === market.id && slip?.selection === String(s.elementId)
          const teamId = clubCtx?.teamIdByElement.get(Number(s.elementId))
          const club = teamId != null ? clubCtx.teamById.get(teamId) : null
          const clubCode = Number(club?.code)
          const badgeUrl = Number.isFinite(clubCode)
            ? `https://resources.premierleague.com/premierleague/badges/50/t${clubCode}.png`
            : null
          const { opponents } = historyOpponentMetaForGw(
            p.gw,
            teamId,
            clubCtx?.fixtures,
            clubCtx?.teamById,
          )
          const fixtureLabel = opponents
            .map((o) => `${o.short} (${o.isHome ? 'H' : 'A'})`)
            .join(', ')
          return (
            <li key={s.elementId} className="bookie-outright__row">
              <span className="bookie-player-board__player">
                {badgeUrl ? (
                  <img
                    className="bookie-player-board__badge"
                    src={badgeUrl}
                    alt={club?.name ?? s.club ?? ''}
                    loading="lazy"
                    width="22"
                    height="22"
                  />
                ) : (
                  <span className="bookie-player-board__badge" aria-hidden="true" />
                )}
                <span className="bookie-player-board__id">
                  <span className="bookie-player-board__name">{s.name}</span>
                  <span className="bookie-player-board__meta">
                    {fixtureLabel || s.club}
                    {' · '}
                    {lastWordTeamName(owner) || standingsMobileTeamName(owner)}
                  </span>
                </span>
              </span>
              <OddsButton
                label={meta.button}
                odds={s.odds}
                active={active}
                disabled={!me || !market.open}
                onClick={() =>
                  onPick({
                    marketId: market.id,
                    selection: String(s.elementId),
                    label: meta.slipLabel(s.name),
                    odds: s.odds,
                    detail: `${matchLabel} · GW${p.gw}`,
                  })
                }
              />
            </li>
          )
        })}
      </ul>
      {selections.length > PLAYER_BOARD_PREVIEW ? (
        <button
          type="button"
          className="bookie-player-board__more"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Short board' : `Full board (${selections.length} prices)`}
        </button>
      ) : null}
    </div>
  )
}

const PLACE_TABS = [
  {
    kind: 'outright',
    tab: 'Champion',
    title: 'League Champion',
    verb: 'Champion',
    crown: 'Champion',
    slipLabel: (name) => `${name} to win the league`,
    detail: 'Outright champion',
    note: 'Pays if they win the league. Odds track Season Predictions and reprice weekly — your ticket locks the price you took.',
  },
  {
    kind: 'titan',
    tab: 'Titan',
    title: 'Titans',
    verb: 'Titan',
    crown: 'Titan',
    slipLabel: (name) => `${name} to finish Titan (top 4)`,
    detail: 'Titan (top 4)',
    note: 'Pays if they finish 1st–4th. Four tickets can win this market.',
  },
  {
    kind: 'minnow',
    tab: 'Minnow',
    title: 'Minnows',
    verb: 'Minnow',
    crown: 'Minnow',
    slipLabel: (name) => `${name} to finish Minnow (bottom 4)`,
    detail: 'Minnow (bottom 4)',
    note: 'Pays if they finish 5th–8th. Four tickets can win this market.',
  },
  {
    kind: 'last',
    tab: 'Last',
    title: 'Last',
    verb: 'Last',
    crown: 'Last',
    slipLabel: (name) => `${name} to finish last`,
    detail: 'Last place',
    note: 'Pays only if they finish 8th.',
  },
]

/**
 * Season-long boards — Champion, Titan, Minnow and Last each fold behind
 * their own collapsed row instead of sharing a tab strip.
 */
function SeasonPlaceBoard({ markets, me, onPick, teamLogoMap, kitIndexByEntry }) {
  const available = PLACE_TABS.filter((t) => markets.some((m) => m.kind === t.kind))
  if (available.length === 0) return null

  return (
    <section className="tile tile--compact" aria-label="Season markets">
      <h3 className="bookie__section-title">Season markets</h3>
      <div className="bookie-punters">
        {available.map((meta) => {
          const market = markets.find((m) => m.kind === meta.kind)
          const selections = market.payload?.selections ?? []
          const settled = market.status === 'settled'
          const winners = new Set(String(market.result ?? '').split(',').filter(Boolean))
          return (
            <details key={meta.kind} className="bookie-punter">
              <summary className="bookie-punter__summary">
                <span className="bookie-punter__name">{meta.title}</span>
                <span className="bookie-punter__meta tabular">
                  {settled
                    ? 'settled'
                    : market.payload?.asOfGw
                      ? `priced after GW${market.payload.asOfGw}`
                      : 'pre-season prices'}
                </span>
              </summary>
              <div className="bookie-fixture__body">
                <ul className="bookie-outright bookie-outright--folded">
                  {selections.map((s) => {
                    const won = settled && winners.has(String(s.entryId))
                    return (
                      <li
                        key={s.entryId}
                        className={
                          'bookie-outright__row' + (won ? ' bookie-outright__row--won' : '')
                        }
                      >
                        <span className="bookie-market__team">
                          <TeamAvatar
                            entryId={Number(s.entryId)}
                            name={s.name}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span>{standingsMobileTeamName(s.name)}</span>
                          {won ? (
                            <span className="bookie-outright__crown" aria-label={meta.crown}>👑</span>
                          ) : null}
                        </span>
                        <OddsButton
                          label={meta.verb}
                          odds={s.odds}
                          active={false}
                          disabled={!me || settled || !market.open}
                          onClick={() =>
                            onPick({
                              marketId: market.id,
                              selection: String(s.entryId),
                              label: meta.slipLabel(standingsMobileTeamName(s.name)),
                              odds: s.odds,
                              detail: meta.detail,
                            })
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
                <p className="bookie__note bookie__note--small">{meta.note}</p>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

function BetSlip({ slip, me, minStake, token, onClose, onPlaced }) {
  const [stake, setStake] = useState(String(minStake))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const stakeNum = Number(stake)
  const valid = Number.isInteger(stakeNum) && stakeNum >= minStake && stakeNum <= me.balance
  const payout = valid ? Math.round(stakeNum * slip.odds) : null

  const place = async () => {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await placeBookieBet(token, {
        marketId: slip.marketId,
        selection: slip.selection,
        stake: stakeNum,
      })
      onPlaced()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <section className="tile tile--compact bookie-slip" aria-label="Bet slip">
      <div className="tile-head-row tile-head-row--tight">
        <h3 className="bookie__section-title">Bet slip</h3>
        <button
          type="button"
          className="bookie-slip__close"
          onClick={onClose}
          aria-label="Close bet slip"
        >
          ×
        </button>
      </div>
      <p className="bookie-slip__pick">
        <strong>{slip.label}</strong>
        <span className="bookie-slip__detail"> · {slip.detail}</span>
        <span className="bookie-slip__odds tabular" title={`decimal ${Number(slip.odds).toFixed(2)}`}>
          {' '}@ {fmtOdds(slip.odds)}
        </span>
      </p>
      <div className="bookie-slip__row">
        <label className="bookie-slip__stake-label" htmlFor="bookie-stake">
          Stake
        </label>
        <input
          id="bookie-stake"
          className="bookie-login__pin bookie-slip__stake"
          type="number"
          inputMode="numeric"
          min={minStake}
          max={me.balance}
          step={1}
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
        <span className="bookie-slip__payout tabular">
          {payout != null ? `returns ${fmtCoins(payout)}` : `min ${minStake}, max ${fmtCoins(me.balance)}`}
        </span>
        <button
          type="button"
          className="bookie__btn bookie__btn--primary"
          disabled={!valid || busy}
          onClick={place}
        >
          {busy ? 'Placing…' : 'Place bet'}
        </button>
      </div>
      {error ? <p className="bookie__error" role="alert">{error}</p> : null}
    </section>
  )
}

/**
 * The tempter's button: a pill in the Cash out column showing the standing
 * offer, arms on the first tap ("sure?"), pays on the second. If the board
 * moves between quote and acceptance the Worker refuses with a fresh number,
 * which is shown instead of silently paying less.
 */
function CashoutButton({ bet, value, token, onCashedOut }) {
  // Parent keys this component by bet id + quoted value, so a fresh quote
  // remounts it — offer/armed/moved never go stale against the prop.
  const [offer, setOffer] = useState(value)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [moved, setMoved] = useState(false)

  const take = async () => {
    setBusy(true)
    try {
      await cashoutBookieBet(token, { betId: bet.id, quote: offer })
      onCashedOut()
    } catch (e) {
      const fresh = Number(e?.data?.cashOut)
      if (Number.isFinite(fresh) && fresh >= 1) {
        setOffer(fresh)
        setMoved(true)
        setArmed(false)
        setBusy(false)
      } else {
        // Offer gone entirely (settled, suspended) — refresh the whole board.
        onCashedOut()
      }
    }
  }

  return (
    <button
      type="button"
      className={'bookie-bet__cashout' + (armed ? ' bookie-bet__cashout--armed' : '')}
      disabled={busy}
      title={
        moved
          ? `Offer moved — take ${fmtCoins(offer)} now and settle this ticket early`
          : `Cash out ${fmtCoins(offer)} now and settle this ticket early`
      }
      aria-label={`Cash out ${fmtCoins(offer)}`}
      onClick={() => (armed ? take() : setArmed(true))}
    >
      {busy ? '…' : armed ? 'Sure?' : fmtCoins(offer)}
    </button>
  )
}

/**
 * One ticket's compact description: the pick in bold, then the context —
 * `Gimli (v Bilbo, GW2)`. Full club names live in the hover title.
 */
function BetDesc({ bet, marketById, nameByEntry }) {
  const { pick, detail } = describeBetCompact(bet, marketById, nameByEntry)
  return (
    <span className="bookie-bet__desc" title={describeBet(bet, marketById, nameByEntry)}>
      <strong className="bookie-bet__pick">{pick}</strong> {detail}
    </span>
  )
}

function MyBets({ me, markets, nameByEntry, cashoutQuotes, token, onCashedOut }) {
  const marketById = useMemo(() => {
    const map = new Map()
    for (const m of markets) map.set(Number(m.id), m)
    return map
  }, [markets])
  const liveGw = liveBoardGameweek(markets)
  const bets = me.bets ?? []
  if (bets.length === 0) {
    return (
      <section className="tile tile--compact" aria-label="My bets">
        <h3 className="bookie__section-title">My bets</h3>
        <p className="bookie__note">No tickets yet. Fortune favours the brave.</p>
      </section>
    )
  }
  return (
    <section className="tile tile--compact" aria-label="My bets">
      <h3 className="bookie__section-title">My bets</h3>
      <ul className="bookie-bets bookie-bets--cashout">
        <BetColHead cashout />
        {bets.map((b) => {
          const quote = b.status === 'open' ? cashoutQuotes.get(Number(b.id)) : undefined
          return (
            <li key={b.id} className={betRowClassName(b, liveGw, marketById)}>
              <BetDesc bet={b} marketById={marketById} nameByEntry={nameByEntry} />
              <BetTicketFigures bet={b} />
              {quote != null && token ? (
                <CashoutButton
                  key={`${b.id}:${quote}`}
                  bet={b}
                  value={quote}
                  token={token}
                  onCashedOut={onCashedOut}
                />
              ) : null}
            </li>
          )
        })}
        <BetTotals bets={bets} />
      </ul>
    </section>
  )
}

/**
 * Everyone's tickets for this gameweek — open ones plus just-settled weekly
 * slips (green) until the next GW's markets print. Tickets were never secret
 * ballots: seeing what your rivals have riding is the point. Grouped per
 * team behind a collapsible row so eight busy punters don't turn the board
 * into a scroll marathon.
 */
function LiveBets({ state, me, markets, nameByEntry, teamLogoMap, kitIndexByEntry }) {
  const marketById = useMemo(() => {
    const map = new Map()
    for (const m of markets) map.set(Number(m.id), m)
    return map
  }, [markets])

  const liveGw = liveBoardGameweek(markets)
  const bets = liveBoardTickets({
    openBets: state.openBets,
    closedBets: state.closedBets,
    markets,
  })
  const byEntry = new Map()
  for (const b of bets) {
    const key = Number(b.entry_id)
    if (!byEntry.has(key)) byEntry.set(key, [])
    byEntry.get(key).push(b)
  }
  const groups = [...byEntry.entries()]
    .map(([entryId, rows]) => ({
      entryId,
      name: rows[0]?.name ?? nameByEntry.get(entryId) ?? String(entryId),
      rows,
      staked: rows.reduce((sum, r) => sum + Number(r.stake), 0),
      riding: rows
        .filter((r) => r.status === 'open' || r.status == null)
        .reduce((sum, r) => sum + Number(r.stake), 0),
    }))
    .sort((a, b) => b.staked - a.staked)

  return (
    <section className="tile tile--compact" aria-label="Live bets">
      <h3 className="bookie__section-title">Live bets — the whole league</h3>
      {groups.length === 0 ? (
        <p className="bookie__note">
          Nothing riding right now. Someone put their Clotcoins where their mouth is.
        </p>
      ) : (
        <div className="bookie-punters">
          {groups.map((g) => {
            const mine = me && g.entryId === Number(me.entryId)
            return (
              <details
                key={g.entryId}
                className={'bookie-punter' + (mine ? ' bookie-punter--mine' : '')}
              >
                <summary className="bookie-punter__summary">
                  <TeamAvatar
                    entryId={g.entryId}
                    name={g.name}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <span className="bookie-punter__name">
                    {standingsMobileTeamName(g.name)}
                    {mine ? ' (you)' : ''}
                  </span>
                  <span className="bookie-punter__meta tabular">
                    {g.rows.length} {g.rows.length === 1 ? 'bet' : 'bets'} · {fmtCoins(g.riding)} riding
                  </span>
                </summary>
                <ul className="bookie-bets bookie-punter__bets">
                  <BetColHead />
                  {g.rows.map((b) => (
                    <li key={b.id} className={betRowClassName(b, liveGw, marketById)}>
                      <BetDesc bet={b} marketById={marketById} nameByEntry={nameByEntry} />
                      <BetTicketFigures bet={b} />
                    </li>
                  ))}
                  <BetTotals bets={g.rows} />
                </ul>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}

function LbSortHead({ col, label, sortKey, sortDir, onSort, align = 'end' }) {
  const active = sortKey === col
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th className={`bookie-lb__th bookie-lb__th--${align}`} aria-sort={ariaSort} scope="col">
      <button
        type="button"
        className={'bookie-lb__sort' + (active ? ' bookie-lb__sort--active' : '')}
        onClick={() => onSort(col)}
      >
        {label}
        {active ? <span className="bookie-lb__dir">{sortDir === 'desc' ? ' ▼' : ' ▲'}</span> : null}
      </button>
    </th>
  )
}

function BookieLeaderboards({ state, me, nameByEntry, teamLogoMap, kitIndexByEntry }) {
  const [sort, setSort] = useState({ sortKey: 'balance', sortDir: 'desc' })

  const allBets = useMemo(
    () => [...(state.openBets ?? []), ...(state.closedBets ?? [])],
    [state.openBets, state.closedBets],
  )

  const marketById = useMemo(() => {
    const map = new Map()
    for (const m of state.markets ?? []) map.set(Number(m.id), m)
    return map
  }, [state.markets])

  const leaderboard = useMemo(() => {
    const rows = enrichLeaderboardRows(state.leaderboard ?? [], allBets)
    return sortLeaderboardRows(rows, sort.sortKey, sort.sortDir)
  }, [state.leaderboard, allBets, sort])

  /** Every team that landed a winning weekly ticket, newest GW first. */
  const weeklyWinners = useMemo(
    () => weeklyWinnerGroups(allBets, state.weeklyNet),
    [state.weeklyNet, allBets],
  )

  if ((state.leaderboard ?? []).length === 0) {
    return (
      <section className="tile tile--compact" aria-label="Leaderboards">
        <h3 className="bookie__section-title">Bankroll leaderboard</h3>
        <p className="bookie__note">Nobody has claimed a team yet — be the first in the book.</p>
      </section>
    )
  }

  const onSort = (col) => setSort((cur) => nextLeaderboardSort(cur.sortKey, cur.sortDir, col))

  return (
    <section className="tile tile--compact" aria-label="Leaderboards">
      <h3 className="bookie__section-title">Bankroll leaderboard</h3>
      <div className="bookie-lb-wrap">
      <table className="bookie-lb">
        <thead>
          <tr className="bookie-lb__row bookie-lb__row--head">
            <th className="bookie-lb__th bookie-lb__th--rank" scope="col">
              <span className="visually-hidden">Rank</span>
            </th>
            <th className="bookie-lb__th bookie-lb__th--team" scope="col">
              Team
            </th>
            <LbSortHead
              col="balance"
              label="Bank"
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSort={onSort}
            />
            <LbSortHead
              col="won"
              label="Won"
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSort={onSort}
            />
            <LbSortHead
              col="lost"
              label="Lost"
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSort={onSort}
            />
            <LbSortHead
              col="live"
              label="Live"
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((u, i) => (
            <tr
              key={u.entryId}
              className={
                'bookie-lb__row' + (me && Number(u.entryId) === Number(me.entryId) ? ' bookie-lb__row--me' : '')
              }
            >
              <td className="bookie-lb__rank tabular">{i + 1}</td>
              <td>
                <span className="bookie-market__team">
                  <TeamAvatar
                    entryId={Number(u.entryId)}
                    name={u.name}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <span>{standingsMobileTeamName(u.name)}</span>
                </span>
              </td>
              <td className="bookie-lb__num bookie-lb__balance tabular">{fmtCoins(u.balance)}</td>
              <td className="bookie-lb__num bookie-lb__won tabular">{fmtCoins(u.won)}</td>
              <td className="bookie-lb__num bookie-lb__lost tabular">{fmtCoins(u.lost)}</td>
              <td className="bookie-lb__num bookie-lb__live tabular">{fmtCoins(u.live)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {weeklyWinners.length > 0 ? (
        <>
          <h3 className="bookie__section-title bookie__section-title--sub">Weekly winners</h3>
          <div className="bookie-winners">
            {weeklyWinners.map((week) => (
              <div key={week.gw} className="bookie-winners__week">
                <div className="bookie-winners__week-label tabular">GW{week.gw}</div>
                <div className="bookie-punters bookie-punters--winners">
                  {week.teams.map((w) => {
                    const name = nameByEntry.get(Number(w.entryId)) ?? String(w.entryId)
                    const mine = me && Number(w.entryId) === Number(me.entryId)
                    const n = w.tickets.length
                    return (
                      <details
                        key={w.entryId}
                        className={'bookie-punter' + (mine ? ' bookie-punter--mine' : '')}
                      >
                        <summary className="bookie-punter__summary">
                          <TeamAvatar
                            entryId={Number(w.entryId)}
                            name={name}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="bookie-punter__name">
                            {standingsMobileTeamName(name)}
                            {mine ? ' (you)' : ''}
                          </span>
                          <span className="bookie-punter__meta tabular">
                            {n} {n === 1 ? 'bet' : 'bets'} ·{' '}
                            <span
                              className={
                                Number(w.net) >= 0
                                  ? 'bookie-winners__net--up'
                                  : 'bookie-winners__net--down'
                              }
                            >
                              {fmtNet(w.net)}
                            </span>
                          </span>
                        </summary>
                        {n > 0 ? (
                          <ul className="bookie-bets bookie-punter__bets">
                            <BetColHead />
                            {w.tickets.map((b) => (
                              <li key={b.id} className="bookie-bet">
                                <BetDesc
                                  bet={b}
                                  marketById={marketById}
                                  nameByEntry={nameByEntry}
                                />
                                <WeeklyWinnerFigures bet={b} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="bookie__note bookie-winners__empty">
                            Winning week — ticket list not in this snapshot.
                          </p>
                        )}
                      </details>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
