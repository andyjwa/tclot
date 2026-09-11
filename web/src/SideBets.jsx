import { useCallback, useEffect, useMemo, useState } from 'react'
import { standingsMobileTeamName } from './teamNameUtils.js'
import {
  actOnSideBet,
  bookieEnabled,
  fetchBookieState,
  loadBookieSession,
  offerSideBet,
} from './bookieApi.js'
import './SideBets.css'

const LIVE = new Set(['offered', 'accepted'])
const CLOSED_LIMIT = 6

function fmtCoins(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString()
}

function shortName(name) {
  return standingsMobileTeamName(name) || name || '—'
}

function involves(bet, entryId) {
  const id = Number(entryId)
  return Number(bet.proposerId) === id || Number(bet.opponentId) === id
}

function between(bet, a, b) {
  return involves(bet, a) && involves(bet, b)
}

function otherParty(bet, entryId) {
  return Number(bet.proposerId) === Number(entryId)
    ? { id: bet.opponentId, name: bet.opponentName }
    : { id: bet.proposerId, name: bet.proposerName }
}

function winnerName(bet) {
  if (Number(bet.winnerId) === Number(bet.proposerId)) return bet.proposerName
  if (Number(bet.winnerId) === Number(bet.opponentId)) return bet.opponentName
  return null
}

function sortBets(bets) {
  const rank = { accepted: 0, offered: 1, settled: 2, void: 3, declined: 4, cancelled: 5 }
  return [...bets].sort((a, b) => {
    const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    if (d !== 0) return d
    return Number(b.id) - Number(a.id)
  })
}

function calledResult(bet) {
  if (bet.proposedResult === 'void') return 'a void'
  if (bet.proposedResult === 'proposer') return `${shortName(bet.proposerName)} won`
  if (bet.proposedResult === 'opponent') return `${shortName(bet.opponentName)} won`
  return null
}

function callerName(bet) {
  if (Number(bet.proposedBy) === Number(bet.proposerId)) return bet.proposerName
  if (Number(bet.proposedBy) === Number(bet.opponentId)) return bet.opponentName
  return 'They'
}

/**
 * Bookie state for team cards and match pages. The Bookie tab already has
 * this payload, so it passes bets in and skips the extra fetch.
 */
function useAutonomousSideBets(active) {
  const enabled = bookieEnabled()
  const [session] = useState(() => (enabled ? loadBookieSession() : null))
  const [state, setState] = useState(null)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!active || !enabled) return undefined
    let alive = true
    fetchBookieState(session?.token ?? null)
      .then((json) => {
        if (alive) setState(json)
      })
      .catch(() => {
        if (alive) setState(null)
      })
    return () => {
      alive = false
    }
  }, [active, enabled, session?.token, nonce])

  const roster = useMemo(() => {
    const map = new Map()
    for (const row of state?.leaderboard ?? []) {
      map.set(Number(row.entryId), row.name)
    }
    for (const market of state?.markets ?? []) {
      for (const sel of market.payload?.selections ?? []) {
        if (sel.entryId != null && sel.name && !map.has(Number(sel.entryId))) {
          map.set(Number(sel.entryId), sel.name)
        }
      }
      if (market.payload?.homeEntryId != null && market.payload.homeName) {
        map.set(Number(market.payload.homeEntryId), market.payload.homeName)
      }
      if (market.payload?.awayEntryId != null && market.payload.awayName) {
        map.set(Number(market.payload.awayEntryId), market.payload.awayName)
      }
    }
    return [...map.entries()].map(([entryId, name]) => ({ entryId, name }))
  }, [state])

  return {
    enabled,
    loading: active && enabled && state == null,
    sideBets: state?.sideBets ?? [],
    me: state?.me ?? null,
    token: session?.token ?? null,
    roster,
    minStake: state?.sideMinStake ?? 10,
    maxStake: state?.sideMaxStake ?? 1000,
    sentenceMin: state?.sideSentenceMin ?? 8,
    sentenceMax: state?.sideSentenceMax ?? 240,
    refresh,
  }
}

function SideBetCard({ bet, me, token, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const mine = me ? involves(bet, me.entryId) : false
  const iProposed = mine && Number(bet.proposerId) === Number(me.entryId)
  const pendingMine = mine && Number(bet.proposedBy) === Number(me.entryId)
  const pendingTheirs = mine && bet.proposedResult && !pendingMine
  const other = mine ? otherParty(bet, me.entryId) : null

  const run = async (action, body = null) => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await actOnSideBet(token, bet.id, action, body)
      onChanged?.()
    } catch (e) {
      setError(e.message || 'That did not go through')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = {
    offered: 'Offered',
    accepted: 'Live',
    settled: 'Settled',
    void: 'Void',
    declined: 'Declined',
    cancelled: 'Cancelled',
  }[bet.status] ?? bet.status

  const pot = fmtCoins(Number(bet.stake) * 2)
  let footnote = null
  if (bet.status === 'offered') {
    footnote = iProposed
      ? `Your ${fmtCoins(bet.stake)} is held until they answer.`
      : `${shortName(bet.proposerName)}'s ${fmtCoins(bet.stake)} is held. Accepting holds the same from you.`
  } else if (bet.status === 'accepted' && !bet.proposedResult) {
    footnote = `${pot} in escrow. One of you calls a result. The other has to confirm before anyone is paid.`
  } else if (bet.status === 'accepted' && bet.proposedResult) {
    footnote = pendingMine
      ? `Waiting on ${shortName(otherParty(bet, me.entryId).name)} to confirm.`
      : `${shortName(callerName(bet))} says ${calledResult(bet)}. Confirming pays it out.`
  } else if (bet.status === 'settled') {
    footnote = `${shortName(winnerName(bet))} took ${fmtCoins(bet.stake)}.`
  } else if (bet.status === 'void') {
    footnote = 'Called void. Both stakes went back.'
  } else if (bet.status === 'declined' || bet.status === 'cancelled') {
    footnote = 'Stake returned.'
  }

  return (
    <article className={`sidebets__card sidebets__card--${bet.status}`}>
      <header className="sidebets__top">
        <span className="sidebets__who">
          {shortName(bet.proposerName)}
          <span className="sidebets__vs"> v </span>
          {shortName(bet.opponentName)}
        </span>
        <span className={`sidebets__chip sidebets__chip--${bet.status}`}>{statusLabel}</span>
      </header>
      <p className="sidebets__sentence">{bet.sentence}</p>
      <p className="sidebets__stake tabular">
        {fmtCoins(bet.stake)} each
        {LIVE.has(bet.status) ? ` · ${pot} pot` : ''}
      </p>
      {footnote ? <p className="sidebets__note">{footnote}</p> : null}
      {mine && token && bet.status === 'offered' ? (
        <div className="sidebets__actions">
          {iProposed ? (
            <button type="button" disabled={busy} onClick={() => run('cancel')}>
              Cancel
            </button>
          ) : (
            <>
              <button type="button" className="sidebets__btn--primary" disabled={busy} onClick={() => run('accept')}>
                Accept
              </button>
              <button type="button" disabled={busy} onClick={() => run('decline')}>
                Decline
              </button>
            </>
          )}
        </div>
      ) : null}
      {mine && token && bet.status === 'accepted' && !bet.proposedResult ? (
        <div className="sidebets__actions">
          <button type="button" disabled={busy} onClick={() => run('propose', { result: 'me' })}>
            I won
          </button>
          <button type="button" disabled={busy} onClick={() => run('propose', { result: 'them' })}>
            {shortName(other?.name)} won
          </button>
          <button type="button" disabled={busy} onClick={() => run('propose', { result: 'void' })}>
            Void
          </button>
        </div>
      ) : null}
      {mine && token && bet.status === 'accepted' && pendingMine ? (
        <div className="sidebets__actions">
          <button type="button" disabled={busy} onClick={() => run('reject')}>
            Take it back
          </button>
        </div>
      ) : null}
      {mine && token && pendingTheirs ? (
        <div className="sidebets__actions">
          <button type="button" className="sidebets__btn--primary" disabled={busy} onClick={() => run('confirm')}>
            Confirm {calledResult(bet)}
          </button>
          <button type="button" disabled={busy} onClick={() => run('reject')}>
            Not agreed
          </button>
        </div>
      ) : null}
      {mine && !token && LIVE.has(bet.status) ? (
        <p className="sidebets__note">Log in on the Bookie tab to answer this.</p>
      ) : null}
      {error ? <p className="sidebets__error">{error}</p> : null}
    </article>
  )
}

function OfferForm({
  me,
  token,
  roster,
  lockedOpponentId,
  lockedOpponentName,
  minStake,
  maxStake,
  sentenceMin,
  sentenceMax,
  onChanged,
}) {
  const opponents = useMemo(() => {
    const rows = (roster ?? []).filter((r) => Number(r.entryId) !== Number(me?.entryId))
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    return rows
  }, [roster, me?.entryId])
  const [opponentId, setOpponentId] = useState(() =>
    lockedOpponentId != null ? String(lockedOpponentId) : '',
  )
  const [stake, setStake] = useState(String(minStake))
  const [sentence, setSentence] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!me || !token) return null
  const stakeNum = Number(stake)
  const balance = Number(me.balance)
  const sentenceText = sentence.replace(/\s+/g, ' ').trim()
  const valid =
    Number.isInteger(stakeNum) &&
    stakeNum >= minStake &&
    stakeNum <= maxStake &&
    stakeNum <= balance &&
    sentenceText.length >= sentenceMin &&
    sentenceText.length <= sentenceMax &&
    (lockedOpponentId != null || opponentId !== '')

  const submit = async (event) => {
    event.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await offerSideBet(token, {
        opponentId: Number(lockedOpponentId ?? opponentId),
        stake: stakeNum,
        sentence: sentenceText,
      })
      setSentence('')
      setOpen(false)
      onChanged?.()
    } catch (e) {
      setError(e.message || 'Could not offer that bet')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    const label =
      lockedOpponentName != null
        ? `Bet ${shortName(lockedOpponentName)}`
        : 'Offer a side bet'
    return (
      <button type="button" className="sidebets__offer-toggle" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }

  return (
    <form className="sidebets__form" onSubmit={submit}>
      {lockedOpponentId == null ? (
        <label className="sidebets__field">
          <span>Opponent</span>
          <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} required>
            <option value="">Pick a team</option>
            {opponents.map((r) => (
              <option key={r.entryId} value={r.entryId}>
                {shortName(r.name)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="sidebets__note">
          Offered to <strong>{shortName(lockedOpponentName)}</strong>. They have to accept before it is live.
        </p>
      )}
      <label className="sidebets__field">
        <span>Stake each</span>
        <input
          type="number"
          inputMode="numeric"
          min={minStake}
          max={Math.min(maxStake, balance)}
          step="1"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
      </label>
      <label className="sidebets__field">
        <span>The bet</span>
        <textarea
          rows={3}
          maxLength={sentenceMax}
          value={sentence}
          placeholder="Eddy outscores Jon this week"
          onChange={(e) => setSentence(e.target.value)}
        />
      </label>
      <p className="sidebets__note">
        Holds {valid ? fmtCoins(stakeNum) : fmtCoins(minStake)} of your coins until they accept, decline, or you cancel.
        No odds. Settling needs them to confirm.
      </p>
      {error ? <p className="sidebets__error">{error}</p> : null}
      <div className="sidebets__actions">
        <button type="submit" className="sidebets__btn--primary" disabled={!valid || busy}>
          Offer bet
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </form>
  )
}

/**
 * Side bets for a pair of teams, one team, or the whole book.
 * Pass `bets` to use a parent fetch. Omit it to load the bookie itself.
 */
export function SideBetsBand({
  bets = null,
  entryId = null,
  homeId = null,
  awayId = null,
  roster = null,
  me = null,
  token = null,
  onChanged = null,
  minStake = null,
  maxStake = null,
  sentenceMin = null,
  sentenceMax = null,
  tone = 'bookie',
  title = 'Side bets',
  lockedOpponentId = null,
  lockedOpponentName = null,
  homeName = null,
  awayName = null,
  hideWhenEmpty = false,
}) {
  const autonomous = bets == null
  const loaded = useAutonomousSideBets(autonomous)
  const all = autonomous ? loaded.sideBets : bets
  const viewer = autonomous ? loaded.me : me
  const authToken = autonomous ? loaded.token : token
  const changed = autonomous ? loaded.refresh : onChanged
  const names = autonomous ? loaded.roster : roster ?? []
  const stakeMin = minStake ?? loaded.minStake
  const stakeMax = maxStake ?? loaded.maxStake
  const sentMin = sentenceMin ?? loaded.sentenceMin
  const sentMax = sentenceMax ?? loaded.sentenceMax

  const relevant = useMemo(() => {
    const rows = Array.isArray(all) ? all : []
    if (homeId != null && awayId != null) return rows.filter((b) => between(b, homeId, awayId))
    if (entryId != null) return rows.filter((b) => involves(b, entryId))
    return rows
  }, [all, homeId, awayId, entryId])

  const live = sortBets(relevant.filter((b) => LIVE.has(b.status)))
  const closed = sortBets(relevant.filter((b) => !LIVE.has(b.status))).slice(0, CLOSED_LIMIT)
  const loggedIn = viewer != null && authToken
  const viewerId = viewer ? Number(viewer.entryId) : null
  const pairMember =
    viewerId != null &&
    homeId != null &&
    awayId != null &&
    (viewerId === Number(homeId) || viewerId === Number(awayId))
  const viewingOther = viewerId != null && entryId != null && viewerId !== Number(entryId)
  const offerLockedId = pairMember
    ? viewerId === Number(homeId)
      ? Number(awayId)
      : Number(homeId)
    : lockedOpponentId
  const offerLockedName = pairMember
    ? viewerId === Number(homeId)
      ? awayName
      : homeName
    : lockedOpponentName
  const canOffer =
    loggedIn &&
    (tone === 'bookie' || pairMember || viewingOther) &&
    (offerLockedId == null || Number(offerLockedId) !== viewerId)
  const allowEmptyOffer = canOffer && (tone === 'bookie' || pairMember || viewingOther)
  const show = tone === 'bookie' || live.length > 0 || closed.length > 0 || allowEmptyOffer

  if (!bookieEnabled()) return null
  if (autonomous && loaded.loading && relevant.length === 0 && !allowEmptyOffer) return null
  if (!show) return null
  if (hideWhenEmpty && live.length === 0 && closed.length === 0 && !allowEmptyOffer) return null

  const pairLabel =
    homeId != null && awayId != null && relevant[0]
      ? `${shortName(relevant[0].proposerName)} and ${shortName(relevant[0].opponentName)}`
      : null

  return (
    <section className={`sidebets sidebets--${tone}`} aria-label={title}>
      <div className="sidebets__head">
        <h3 className="sidebets__title">{title}</h3>
      </div>
      {tone === 'bookie' ? (
        <p className="sidebets__lead">
          Two managers, one sentence, equal stakes. Your coins are held until they accept
          or you cancel. Nobody else can join, and the pot only moves when the other
          person confirms who won, or that it is void.
        </p>
      ) : null}
      {canOffer ? (
        <OfferForm
          me={viewer}
          token={authToken}
          roster={
            lockedOpponentId != null
              ? [{ entryId: Number(lockedOpponentId), name: lockedOpponentName || 'Opponent' }]
              : names
          }
          lockedOpponentId={offerLockedId}
          lockedOpponentName={
            offerLockedName ??
            names.find((r) => Number(r.entryId) === Number(offerLockedId))?.name ??
            null
          }
          minStake={stakeMin}
          maxStake={stakeMax}
          sentenceMin={sentMin}
          sentenceMax={sentMax}
          onChanged={changed}
        />
      ) : null}
      {live.length === 0 && closed.length === 0 ? (
        <p className="sidebets__note">
          {pairLabel
            ? `Nothing between ${pairLabel} yet.`
            : loggedIn
              ? 'No side bets yet.'
              : 'No side bets yet. Log in above to offer one.'}
        </p>
      ) : null}
      <div className="sidebets__list">
        {live.map((bet) => (
          <SideBetCard key={bet.id} bet={bet} me={viewer} token={authToken} onChanged={changed} />
        ))}
        {closed.map((bet) => (
          <SideBetCard key={bet.id} bet={bet} me={viewer} token={authToken} onChanged={changed} />
        ))}
      </div>
    </section>
  )
}

/** Team card. Hidden on archive seasons and when there is nothing to show. */
export function TeamSideBets({ teamId, idToName = {} }) {
  if (typeof window !== 'undefined') {
    const season = new URLSearchParams(window.location.search).get('season')
    if (season && /^\d{4}-\d{2}$/.test(season)) return null
  }
  const session = loadBookieSession()
  const locked =
    session && Number(session.entryId) !== Number(teamId)
      ? { id: Number(teamId), name: idToName[teamId] || idToName[String(teamId)] }
      : null
  return (
    <SideBetsBand
      entryId={teamId}
      tone="card"
      title="Side bets"
      lockedOpponentId={locked?.id ?? null}
      lockedOpponentName={locked?.name ?? null}
      hideWhenEmpty
    />
  )
}
