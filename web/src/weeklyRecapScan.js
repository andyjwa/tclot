/**
 * Scan-first recap/preview copy. Header tiles, per-fixture stat boxes, and
 * a recap box from the shared blurb engine: one data angle, max two sentences,
 * Mottershead vegan required as sentence 2.
 */

import {
  allManagerJokes,
  isMottershead,
  loreTagsFromSide,
  managerFunFact,
  mottersheadVeganLine,
} from './leagueLore.js'
import {
  benchWeek,
  draftPickFor,
  formThrough,
  playerPriorPts,
  titleModelFor,
} from './recapSiteContext.js'
import { standingsMobileTeamName } from './teamNameUtils.js'
import { variantIndex } from './variantIndex.js'
import {
  decoratePersonality,
  generateMatchupBlurb,
  hydrateUsedBag,
  rememberBlurb,
} from './blurbEngine.js'

const TABLE_OPEN = /^(That leaves|That keeps|Both sides finished)\b/
const QUIPPY =
  /vegan|twin|sleep|complimentary|people'?s champion|invented|cheerfully|plant-based|whatever sleep/i
const STALE_TAKE = /will have a take/i

export function shortTeam(name) {
  return standingsMobileTeamName(name) || name || '–'
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export function stripEnd(s) {
  return String(s || '')
    .replace(/[.!?]+$/, '')
    .trim()
}

const pick = (arr, key) => arr[variantIndex(key, arr.length)]

function firstName(mgr) {
  const s = String(mgr ?? '').trim()
  return s ? s.split(/\s+/)[0] : null
}

function who(side) {
  return firstName(side?.manager) || side?.name || 'they'
}

function favSide(m) {
  if (m?.odds?.favoriteSide === 'away') return m.away
  if (m?.odds?.favoriteSide === 'home') return m.home
  return null
}

function sameLine(a, b) {
  return stripEnd(a).toLowerCase() === stripEnd(b).toLowerCase()
}

function overlaps(line, used) {
  const n = stripEnd(line).toLowerCase()
  if (!n) return true
  for (const u of used) {
    const other = stripEnd(u).toLowerCase()
    if (!other) continue
    if (n === other) return true
    if (n.length > 24 && other.includes(n)) return true
    if (other.length > 24 && n.includes(other)) return true
  }
  return false
}

function fixtureKey(m, preview) {
  const gw = m?.gw ?? ''
  return `${preview ? 'p' : 'r'}-${gw}-${m?.home?.entryId ?? ''}-${m?.away?.entryId ?? ''}`
}

export function pickQuip(sentences) {
  const list = (sentences || []).map(stripEnd).filter(Boolean)
  return (
    list.find((s) => QUIPPY.test(s)) ||
    list.find((s) => !TABLE_OPEN.test(s) && !/\d{2}%/.test(s) && s.length < 96) ||
    null
  )
}

const STEM_RULES = [
  ['projected-stack', /projected stack/i],
  ['hinge', /hinge is|\bhinge\b/i],
  ['biggest-return', /biggest return/i],
  ['led-with', /\bled\b.+\bwith\b/i],
  ['heavy-lift', /heavy lifting/i],
  ['rode', /\brode\b/i],
  ['dud-for', /the dud for/i],
  ['clip', /will not want the clip/i],
  ['blanked', /blanked from/i],
  ['stale-take', /will have a take/i],
  ['waiver-claimed', /claimed .+ on the /i],
  ['waiver-new', /is the new (waiver|free-agent)/i],
  ['waiver-dud', /returned \d/i],
  ['waiver-paid', / paid \d/i],
  ['streak', /\d+-game (winning|losing) streak/i],
  ['winless', /waiting on a first win|kind of record/i],
  ['table-talk', /not being subtle|doing some talking/i],
  ['vegan', /vegan|oat milk|tofu|plant-based/i],
  ['call-hit', /was the call|night agreed/i],
  ['call-miss', /scoreboard disagreed|wrecked a/i],
  ['book-both', /the book has/i],
  ['board-both', /on the board/i],
  ['engine-both', /the engine has/i],
  ['watch-is', /'s watch is/i],
  ['title-price', /for the title/i],
]

export function recapStem(text) {
  const s = String(text || '')
  for (const [id, re] of STEM_RULES) {
    if (re.test(s)) return id
  }
  const fallback = stripEnd(s).toLowerCase()
  return fallback.slice(0, 48) || 'other'
}

function usedBag(used) {
  if (Array.isArray(used)) return { lines: [...used], kinds: [], stems: [] }
  return {
    lines: [...(used?.lines || [])],
    kinds: [...(used?.kinds || [])],
    stems: [...(used?.stems || [])],
  }
}

function angle(kind, text, about = null) {
  const t = stripEnd(text)
  if (!t) return null
  return { kind, text: t, stem: recapStem(t), about }
}

function isFree(a, bag) {
  if (!a?.text || STALE_TAKE.test(a.text)) return false
  if (overlaps(a.text, bag.lines)) return false
  if (a.kind === 'vegan') return true
  if (bag.stems.includes(a.stem)) return false
  return true
}

const FOLLOW_ON =
  /^(The|A|An|That|This|His|Her|Their|For|If|When|While|After|With|Question|Somewhere|Plant-based)\b/

function lcFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

function asFollowOn(s) {
  const t = stripEnd(s)
  return FOLLOW_ON.test(t) ? lcFirst(t) : t
}

function _weave(lead, aside) {
  if (!aside) return stripEnd(lead)
  if (!lead) return stripEnd(aside)
  return `${stripEnd(lead)}, ${asFollowOn(aside)}`
}

function pickupKind(kind) {
  return kind === 'f' ? 'free-agent' : 'waiver'
}

function pickupBits(side) {
  const bits = []
  const p = side?.pickup
  if (p?.name) bits.push(p)
  if (p?.star?.name) bits.push(p.star)
  if (p?.flop?.name) bits.push({ ...p.flop, dud: true })
  for (const r of side?.recentPickups || []) {
    if (r?.name) bits.push(r)
  }
  return bits
}

function recordLine(side, key) {
  const rec = side?.record
  if (!rec) return null
  const w = Number(rec.w) || 0
  const d = Number(rec.d) || 0
  const l = Number(rec.l) || 0
  const played = w + d + l
  const rank = Number(side?.rank)
  if (played >= 3 && w === 0) {
    return pick(
      [
        `${who(side)} is ${w}-${d}-${l} and still waiting on a first win`,
        `${who(side)}'s ${w}-${d}-${l} is the kind of record that gets a subcommittee`,
      ],
      `${key}-winless`,
    )
  }
  if (played >= 4 && l >= 3 && l >= w * 2) {
    return `${who(side)} sits ${w}-${d}-${l}, which is doing some talking of its own`
  }
  if (Number.isFinite(rank) && rank >= 7 && played >= 2) {
    return `${who(side)} is ${ordinal(rank)}, and the table is not being subtle about it`
  }
  return null
}

function streakLine(side) {
  const st = side?.streak
  if (!st || !Number.isFinite(st.len) || st.len <= 2) return null
  const kind = st.type === 'W' ? 'winning' : st.type === 'L' ? 'losing' : 'unbeaten'
  if (st.type === 'D') return null
  return `${who(side)} is on a ${st.len}-game ${kind} streak`
}

function pushVariants(out, kind, texts, about = null) {
  for (const t of texts) {
    const a = angle(kind, t, about)
    if (a) out.push(a)
  }
}

function otherSide(m, side) {
  if (!side) return null
  const id = Number(side.entryId)
  const homeId = Number(m?.home?.entryId)
  if (Number.isFinite(id) && Number.isFinite(homeId)) {
    return id === homeId ? m.away : m.home
  }
  if (side.name && side.name === m?.home?.name) return m.away
  if (side.name && side.name === m?.away?.name) return m.home
  return side === m?.home ? m.away : m.home
}

function recFmt(side) {
  const r = side?.record
  if (!r) return null
  return `${Number(r.w) || 0}-${Number(r.d) || 0}-${Number(r.l) || 0}`
}

function predFor(m, side) {
  if (!side) return null
  if (side.entryId != null && side.entryId === m?.home?.entryId) return m?.predicted?.home
  if (side.entryId != null && side.entryId === m?.away?.entryId) return m?.predicted?.away
  return null
}

function lastTeamWeek(priorGws, entryId) {
  if (!Number.isFinite(entryId)) return null
  const gws = [...(priorGws || [])].sort((a, b) => (b.gw || 0) - (a.gw || 0))
  for (const gw of gws) {
    for (const row of gw.matchups || []) {
      for (const s of [row.home, row.away]) {
        if (s?.entryId === entryId && Number.isFinite(s.points)) {
          return {
            gw: gw.gw,
            points: s.points,
            rank: s.rank,
            top: s.players?.top || null,
          }
        }
      }
    }
  }
  return null
}

function lastPlayerWeeks(priorGws, playerId) {
  if (!Number.isFinite(playerId)) return []
  const out = []
  for (const gw of priorGws || []) {
    for (const row of gw.matchups || []) {
      for (const s of [row.home, row.away]) {
        for (const p of [s?.players?.top, s?.players?.flop, s?.players?.haul]) {
          if (p?.id === playerId && Number.isFinite(p.pts)) {
            out.push({ gw: gw.gw, pts: p.pts })
          }
        }
      }
    }
  }
  return out
}

function callAngles(m) {
  const fav = favSide(m)
  const dog = otherSide(m, fav)
  const about = { side: fav, opp: dog }
  if (m?.odds?.outcome === 'hit' && fav) {
    return [
      angle('call', `${who(fav)} was the call and it stood`, about),
      angle('call', `The book had ${shortTeam(fav.name)} and the night agreed`, about),
    ].filter(Boolean)
  }
  if (m?.odds?.outcome === 'miss' && fav) {
    const pct = Number.isFinite(m.odds.favoritePct)
      ? `${Math.round(m.odds.favoritePct)}%`
      : 'pre-match'
    return [
      angle('call', `The model had ${who(fav)} and the scoreboard disagreed`, about),
      angle('call', `${who(dog)} wrecked a ${pct} favourite`, about),
    ].filter(Boolean)
  }
  return []
}

/** Tagged fixture notes: one kind per angle, several stems to rotate. */
export function fixtureStoryAngles(m, preview = false, key = 's') {
  const out = []
  for (const [side, salt] of [
    [m?.home, `${key}-h`],
    [m?.away, `${key}-a`],
  ]) {
    if (!side) continue
    const opp = otherSide(m, side)
    for (const p of pickupBits(side)) {
      const label = pickupKind(p.kind)
      const about = { side, opp, pickup: p }
      if (p.dud || (Number.isFinite(p.xp) && Number.isFinite(p.pts) && p.pts <= 2 && p.xp >= 4)) {
        pushVariants(
          out,
          'waiver',
          [
            `${who(side)}'s ${label} ${p.name} returned ${p.pts ?? 0}${p.xp != null ? ` off ${p.xp}` : ''}`,
          ],
          about,
        )
      } else if (Number.isFinite(p.pts) && p.pts >= 8) {
        pushVariants(out, 'waiver', [`${who(side)}'s ${label} ${p.name} paid ${p.pts}`], about)
      } else {
        pushVariants(
          out,
          'waiver',
          [
            `${who(side)} claimed ${p.name} on the ${label}`,
            `${p.name} is the new ${label} in ${shortTeam(side.name)}`,
          ],
          about,
        )
      }
    }

    if (preview) {
      const watch = [...(side.keys || [])]
        .filter((k) => k?.name)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))[0]
      if (watch) {
        pushVariants(
          out,
          'projected',
          [
            `${who(side)}'s hinge is ${watch.name} at ${watch.xp}`,
            `The projected stack for ${shortTeam(side.name)} runs through ${watch.name} (${watch.xp})`,
            `${watch.name} is the ${watch.xp} watch for ${who(side)}`,
          ],
          { side, opp, player: watch },
        )
      }
    } else {
      const top = side.players?.top
      if (top?.name && Number.isFinite(top.pts)) {
        pushVariants(
          out,
          'haul',
          [
            `${top.name} led ${shortTeam(side.name)} with ${top.pts}`,
            `Biggest return in ${shortTeam(side.name)}: ${top.name} on ${top.pts}`,
            `${who(side)} rode ${top.name} to ${top.pts}`,
            `${top.name}'s ${top.pts} did the heavy lifting for ${shortTeam(side.name)}`,
          ],
          { side, opp, player: top },
        )
      }
      const flop = side.players?.flop
      if (flop?.name && Number.isFinite(flop.pts)) {
        pushVariants(
          out,
          'dud',
          [
            `${flop.name} the dud for ${who(side)}: ${flop.pts}${flop.xp != null ? ` from ${flop.xp}` : ''}`,
            `${who(side)} will not want the clip of ${flop.name} walking off with ${flop.pts}`,
            `${flop.name} blanked from ${flop.xp ?? 'a decent projection'} for ${who(side)}`,
          ],
          { side, opp, player: flop },
        )
      }
    }

    const streak = streakLine(side)
    if (streak) out.push(angle('streak', streak, { side, opp }))
    const rec = recordLine(side, salt)
    if (rec) out.push(angle('record', rec, { side, opp }))
  }
  if (!preview) out.push(...callAngles(m))
  return out.filter(Boolean)
}

export function fixtureStoryLines(m, preview = false, key = 's') {
  const seen = new Set()
  const out = []
  for (const a of fixtureStoryAngles(m, preview, key)) {
    if (seen.has(a.text)) continue
    seen.add(a.text)
    out.push(a.text)
  }
  return out
}

function pct(n) {
  if (!Number.isFinite(n)) return null
  return `${Math.round(n * 100)}%`
}

function vsPredLine(m, side) {
  const pred = predFor(m, side)
  if (!Number.isFinite(pred) || !Number.isFinite(side?.points)) return null
  const d = Math.round(side.points - pred)
  if (d === 0) {
    return `${who(side)} landed on the ${pred} the engine printed`
  }
  if (d > 0) {
    return `${who(side)} put up ${side.points} against a ${pred} projection, ${d} clear`
  }
  return `${who(side)} finished ${side.points} against a ${pred} projection, ${-d} short`
}

function vsAvgLine(side) {
  if (!Number.isFinite(side?.points) || !Number.isFinite(side?.seasonAvg)) return null
  const d = Math.round(side.points - side.seasonAvg)
  if (Math.abs(d) < 1) {
    return `${who(side)}'s ${side.points} sat on the season clip (${side.seasonAvg})`
  }
  if (d > 0) {
    return `That's ${d} above ${who(side)}'s ${side.seasonAvg} season clip`
  }
  return `That's ${-d} under ${who(side)}'s ${side.seasonAvg} season clip`
}

function lastTeamLine(side, priorGws) {
  const last = lastTeamWeek(priorGws, side?.entryId)
  if (!last) return null
  if (Number.isFinite(side?.points)) {
    const d = side.points - last.points
    if (d > 2) {
      return `Up from ${last.points} in GW${last.gw}`
    }
    if (d < -2) {
      return `Down from ${last.points} in GW${last.gw}`
    }
    return `Same neighbourhood as the ${last.points} in GW${last.gw}`
  }
  return `${shortTeam(side.name)} put up ${last.points} in GW${last.gw}`
}

function lastPlayerLine(player, priorGws, site = null, gw = null) {
  let rows = lastPlayerWeeks(priorGws, player?.id)
  if (!rows.length && site && Number.isFinite(gw)) {
    rows = playerPriorPts(site, player?.id, gw)
  }
  if (!rows.length || !Number.isFinite(player?.pts)) return null
  const last = rows[rows.length - 1]
  if (last.pts === player.pts) {
    return `${player.name} also had ${last.pts} in GW${last.gw}`
  }
  if (player.pts > last.pts) {
    return `That's up from ${last.pts} in GW${last.gw}`
  }
  return `That's down from ${last.pts} in GW${last.gw}`
}

function benchLine(site, side, gw) {
  const week = benchWeek(site, side?.entryId, gw)
  if (!week) return null
  const sit = [...(week.leftOnBench || [])].sort((a, b) => (b.pts || 0) - (a.pts || 0))[0]
  if (sit?.name && Number.isFinite(sit.pts) && sit.pts >= 6) {
    return `${sit.name} had ${sit.pts} on the bench${Number.isFinite(week.benchLeft) ? `, ${week.benchLeft} left sitting` : ''}`
  }
  if (Number.isFinite(week.benchLeft) && week.benchLeft >= 6) {
    return `${who(side)} left ${week.benchLeft} on the pine`
  }
  return null
}

function draftLine(site, player) {
  const pick = draftPickFor(site, player?.id)
  if (!pick || !player?.name) return null
  const n = Number(pick.overallPick)
  if (!Number.isFinite(n)) return null
  if (n <= 8 && Number.isFinite(player.pts) && player.pts <= 2) {
    return `${player.name} went ${ordinal(n)} overall and returned ${player.pts}`
  }
  if (n >= 40 && Number.isFinite(player.pts) && player.pts >= 8) {
    return `A ${ordinal(n)} overall pick putting up ${player.pts}`
  }
  if (n <= 12 && Number.isFinite(player.xp) && !Number.isFinite(player.pts)) {
    return `${player.name} was the ${ordinal(n)} pick; the hinge is not a coincidence`
  }
  return null
}

function titleModelLine(site, side) {
  const t = titleModelFor(site, side?.entryId)
  if (!t) return null
  if (Number.isFinite(t.lastPct) && t.lastPct >= 18) {
    return `The title model still has ${shortTeam(side.name)} at ${Math.round(t.lastPct)}% for last`
  }
  if (Number.isFinite(t.titlePct) && t.titlePct >= 18) {
    return `The title model has ${shortTeam(side.name)} at ${t.titlePct.toFixed(1)}%`
  }
  if (Number.isFinite(t.avgFinish)) {
    return `${shortTeam(side.name)} is a ${t.avgFinish.toFixed(1)} expected finish on the season board`
  }
  return null
}

function formLine(site, side, gw, preview) {
  const form = formThrough(site, side?.entryId, gw, preview)
  if (!form || form.played < 2) return null
  const tail = form.recent.slice(-3).join('')
  if (form.played >= 3 && form.w === 0) {
    return `${who(side)} is ${form.w}-${form.d}-${form.l} through ${form.played} (${tail})`
  }
  if (form.recent.slice(-3).join('') === 'WWW') {
    return `${who(side)} has taken the last three: ${tail}`
  }
  if (form.played >= 3) {
    return `The H2H tape on ${who(side)} reads ${form.w}-${form.d}-${form.l}`
  }
  return null
}

function shareLine(side, player) {
  const share = side?.players?.share
  if (!player || !Number.isFinite(share) || !Number.isFinite(side?.points)) return null
  return `${player.name}'s ${player.pts} was ${pct(share)} of the ${side.points}`
}

function titleSwingLine(side) {
  const o = side?.titleOdds
  if (!o || !Number.isFinite(o.before) || !Number.isFinite(o.after)) return null
  if (Math.abs(o.after - o.before) < 0.4) return null
  const dir = o.after > o.before ? 'up' : 'down'
  return `${shortTeam(side.name)}'s title price moved ${dir} from ${formatTitlePct(o.before)} to ${formatTitlePct(o.after)}`
}

function tableLine(side) {
  const rec = recFmt(side)
  const rank = Number(side?.rank)
  const played =
    (Number(side?.record?.w) || 0) +
    (Number(side?.record?.d) || 0) +
    (Number(side?.record?.l) || 0)
  if (played < 1) return null
  if (Number.isFinite(rank) && rank >= 1 && rec) {
    return `${who(side)} is ${ordinal(rank)} at ${rec}`
  }
  if (rec) return `${who(side)} sits ${rec}`
  if (Number.isFinite(rank) && rank >= 1) return `${who(side)} is ${ordinal(rank)}`
  return null
}

function rankMoveLine(side) {
  const rank = Number(side?.rank)
  const prev = Number(side?.prevRank)
  if (!Number.isFinite(rank) || rank < 1 || !Number.isFinite(prev) || prev < 1 || rank === prev) return null
  if (rank < prev) {
    return `${who(side)} climbed from ${ordinal(prev)} to ${ordinal(rank)}`
  }
  return `${who(side)} slipped from ${ordinal(prev)} to ${ordinal(rank)}`
}

function resultLine(m, side) {
  if (!Number.isFinite(m?.home?.points) || !Number.isFinite(m?.away?.points)) return null
  const opp = otherSide(m, side)
  const won = m.winner != null ? m.winner === side?.entryId : side.points > (opp?.points ?? -1)
  const margin = Number.isFinite(m.margin)
    ? m.margin
    : Math.abs(side.points - (opp?.points ?? 0))
  if (!opp) return `The night finished ${m.home.points}–${m.away.points}`
  if (won) {
    return `${who(side)} beat ${shortTeam(opp.name)} by ${margin}`
  }
  return `${who(side)} lost to ${shortTeam(opp.name)} by ${margin}`
}

function teamTokens(side) {
  const out = []
  for (const raw of [side?.name, shortTeam(side?.name), squareTeam(side?.name)]) {
    const s = String(raw || '')
      .toLowerCase()
      .trim()
    if (s.length >= 3 && s !== '–') out.push(s)
    for (const w of s.split(/[\s.]+/)) {
      if (w.length >= 4) out.push(w)
    }
  }
  return [...new Set(out)]
}

function mentionsSide(text, side) {
  const blob = String(text || '').toLowerCase()
  return teamTokens(side).some((t) => blob.includes(t))
}

function mentionsBothSides(lines, m) {
  const blob = Array.isArray(lines) ? lines.join(' ') : String(lines || '')
  return mentionsSide(blob, m?.home) && mentionsSide(blob, m?.away)
}

/** Theme-true sentence that still names the other side. */
function oppOnTheme(m, news) {
  const side = news?.about?.side || favSide(m) || m?.home
  const opp = news?.about?.opp || otherSide(m, side)
  if (!side || !opp?.name) return null
  const kind = news?.kind
  const result = resultLine(m, side)
  const oppTop = opp.players?.top
  if (kind === 'haul' || kind === 'waiver') {
    if (oppTop?.name && Number.isFinite(oppTop.pts)) {
      return `${shortTeam(opp.name)}'s best was ${oppTop.name} on ${oppTop.pts}`
    }
    return result
  }
  if (kind === 'dud') {
    return (
      result ||
      (oppTop?.name && Number.isFinite(oppTop.pts)
        ? `${who(opp)} still had ${oppTop.name} on ${oppTop.pts}`
        : null)
    )
  }
  if (kind === 'streak' || kind === 'record') {
    return (
      result ||
      (Number.isFinite(opp.points) ? `${shortTeam(opp.name)} finished on ${opp.points}` : null)
    )
  }
  if (kind === 'call') return result || vsPredLine(m, opp)
  return (
    result ||
    (oppTop?.name ? `${shortTeam(opp.name)}'s night ran through ${oppTop.name}` : null)
  )
}

function isVeganLine(s) {
  return /vegan|oat milk|tofu|plant-based/i.test(s)
}

function sideOnTheme(m, news, side) {
  if (!side?.name) return null
  const kind = news?.kind
  const top = side.players?.top
  if ((kind === 'haul' || kind === 'waiver') && top?.name && Number.isFinite(top.pts)) {
    return `${shortTeam(side.name)}'s best was ${top.name} on ${top.pts}`
  }
  if (kind === 'call' && Number.isFinite(m?.odds?.favoritePct) && favSide(m) === side) {
    return `${shortTeam(side.name)} were the ${Math.round(m.odds.favoritePct)}% favourite`
  }
  if (Number.isFinite(side.points)) {
    return `${shortTeam(side.name)} finished on ${side.points}`
  }
  if (top?.name) return `${shortTeam(side.name)}'s night ran through ${top.name}`
  return `${shortTeam(side.name)} were the other name on the card`
}

function _ensureBothSides(lines, m, news) {
  if (mentionsBothSides(lines, m)) return
  const missing = [m?.home, m?.away].filter((s) => s?.name && !mentionsSide(lines.join(' '), s))
  for (const side of missing) {
    if (mentionsBothSides(lines, m)) return
    let extra = side === (news?.about?.opp || otherSide(m, news?.about?.side))
      ? oppOnTheme(m, news)
      : sideOnTheme(m, news, side)
    if (extra && overlaps(extra, lines)) extra = null
    if (!extra) extra = sideOnTheme(m, news, side)
    if (!extra || overlaps(extra, lines)) continue
    if (lines.length >= 4) {
      let replaced = false
      for (let i = lines.length - 1; i >= 1; i -= 1) {
        if (isVeganLine(lines[i])) continue
        const trial = lines.slice()
        trial[i] = extra
        if (mentionsBothSides(trial, m) || mentionsSide(extra, side)) {
          lines[i] = extra
          replaced = true
          break
        }
      }
      if (!replaced) lines.push(extra)
    } else {
      lines.push(extra)
    }
  }
}

/** Keep four lines without dropping vegan or the only mention of a side. */
function _trimRecap(lines, m) {
  while (lines.length > 4) {
    let idx = -1
    for (let i = lines.length - 1; i >= 1; i -= 1) {
      if (isVeganLine(lines[i])) continue
      const without = lines.filter((_, j) => j !== i)
      if (mentionsBothSides(lines, m) && !mentionsBothSides(without, m)) continue
      idx = i
      break
    }
    if (idx < 0) lines.pop()
    else lines.splice(idx, 1)
  }
}

function predPreviewLine(m, side) {
  const pred = predFor(m, side)
  const opp = otherSide(m, side)
  const oppPred = predFor(m, opp)
  if (!Number.isFinite(pred)) return null
  if (Number.isFinite(oppPred)) {
    return `The engine has ${shortTeam(side.name)} at ${pred} and ${shortTeam(opp.name)} at ${oppPred}`
  }
  return `The engine has ${shortTeam(side.name)} at ${pred}`
}

function bookLine(m, side) {
  const pctWin = side?.entryId === m?.home?.entryId ? m?.odds?.home : m?.odds?.away
  const favPct = m?.odds?.favoritePct
  if (Number.isFinite(pctWin)) {
    return `${shortTeam(side.name)} is ${Math.round(pctWin)}% on the board`
  }
  if (Number.isFinite(favPct) && favSide(m) === side) {
    return `${shortTeam(side.name)} is the ${Math.round(favPct)}% favourite`
  }
  return null
}

function keyShareLine(side, player) {
  const pred = Number(side?.strength)
  if (!player || !Number.isFinite(player.xp) || !Number.isFinite(pred) || pred <= 0) return null
  return `${player.name}'s ${player.xp} is ${pct(player.xp / pred)} of a ${pred} XI`
}

/**
 * Extra sentences that stay on the chosen news theme, using baked site data
 * (projections, share, record, last week, title swing).
 */
export function themeSupport(m, news, { preview = false, priorGws = [], site = null, key = 's' } = {}) {
  const side = news?.about?.side || favSide(m) || m?.home
  const opp = news?.about?.opp || otherSide(m, side)
  const player = news?.about?.player
  const pickup = news?.about?.pickup
  const gw = m?.gw
  const pool = []

  const add = (line) => {
    const s = stripEnd(line)
    if (!s || STALE_TAKE.test(s)) return
    if (news?.text && overlaps(s, [news.text])) return
    if (pool.some((p) => overlaps(s, [p]))) return
    pool.push(s)
  }

  add(oppOnTheme(m, news))

  if (news?.kind === 'haul') {
    add(shareLine(side, player))
    add(lastPlayerLine(player, priorGws, site, gw))
    add(draftLine(site, player))
    add(vsPredLine(m, side))
    add(vsAvgLine(side))
    add(lastTeamLine(side, priorGws))
    add(benchLine(site, side, gw))
    if (opp?.players?.top?.name && player?.name && opp.players.top.name !== player.name) {
      add(`${shortTeam(opp.name)}'s best was ${opp.players.top.name} on ${opp.players.top.pts}`)
    }
    add(resultLine(m, side))
  } else if (news?.kind === 'dud') {
    if (Number.isFinite(player?.xp) && Number.isFinite(player?.pts)) {
      add(`${player.name} was ${Math.round(player.xp - player.pts)} short of ${player.xp}`)
    }
    add(lastPlayerLine(player, priorGws, site, gw))
    add(draftLine(site, player))
    add(benchLine(site, side, gw))
    add(vsPredLine(m, side))
    add(shareLine(side, side?.players?.top))
    add(resultLine(m, side))
    add(lastTeamLine(side, priorGws))
  } else if (news?.kind === 'streak') {
    add(tableLine(side))
    add(formLine(site, side, gw, preview))
    add(rankMoveLine(side))
    add(vsPredLine(m, side))
    add(vsAvgLine(side))
    add(lastTeamLine(side, priorGws))
    add(titleSwingLine(side))
    add(titleModelLine(site, side))
    add(resultLine(m, side))
  } else if (news?.kind === 'record') {
    add(formLine(site, side, gw, preview))
    add(rankMoveLine(side))
    add(vsPredLine(m, side))
    add(vsAvgLine(side))
    add(lastTeamLine(side, priorGws))
    add(titleSwingLine(side))
    add(titleModelLine(site, side))
    add(resultLine(m, side))
  } else if (news?.kind === 'waiver') {
    if (Number.isFinite(pickup?.pts) && Number.isFinite(pickup?.xp)) {
      add(`${pickup.name} was projected ${pickup.xp} and returned ${pickup.pts}`)
    }
    add(draftLine(site, pickup))
    add(vsPredLine(m, side))
    add(lastTeamLine(side, priorGws))
    add(tableLine(side))
    add(formLine(site, side, gw, preview))
    add(resultLine(m, side))
    add(predPreviewLine(m, side))
    add(bookLine(m, side))
    add(titleModelLine(site, side))
    add(keyShareLine(side, side?.keys?.[0]))
  } else if (news?.kind === 'projected') {
    add(keyShareLine(side, player))
    add(lastPlayerLine({ ...player, pts: player?.xp }, priorGws, site, gw))
    add(draftLine(site, player))
    add(lastTeamLine(side, priorGws))
    add(predPreviewLine(m, side))
    add(bookLine(m, side))
    add(titleModelLine(site, side))
    if (opp?.keys?.[0]?.name && opp.keys[0].name !== player?.name) {
      add(`${shortTeam(opp.name)} answers with ${opp.keys[0].name} at ${opp.keys[0].xp}`)
    }
  } else if (news?.kind === 'call') {
    add(vsPredLine(m, side))
    add(vsPredLine(m, opp))
    add(resultLine(m, side))
    add(titleSwingLine(side))
    add(titleModelLine(site, side))
    add(tableLine(side))
    add(formLine(site, side, gw, preview))
  } else {
    add(vsPredLine(m, side))
    add(lastTeamLine(side, priorGws))
    add(tableLine(side))
    add(formLine(site, side, gw, preview))
    add(resultLine(m, side))
    add(predPreviewLine(m, side))
    add(titleModelLine(site, side))
  }

  const n = pick([2, 2, 3], `${key}-support-n`)
  return pool.slice(0, n)
}

const JOKE_SKIP = new Set(['waiver', 'dud', 'streak', 'record'])

function _assignNews(angles, bag, key) {
  const unusedKind = angles.filter((a) => isFree(a, bag) && !bag.kinds.includes(a.kind))
  const pool = unusedKind.length ? unusedKind : angles.filter((a) => isFree(a, bag))
  if (!pool.length) return null
  return pick(pool, `${key}-news`)
}

function jokeAngle(side, salt, bag) {
  if (!side?.manager || isMottershead(side.manager)) return null
  const tags = loreTagsFromSide(side)
  const hooked = managerFunFact(side.manager, pick, salt, tags)
  const pool = [hooked, ...allManagerJokes(side.manager)]
    .map((t) => angle('joke', t))
    .filter((a) => isFree(a, bag))
  if (!pool.length) return null
  return pick(pool, salt)
}

function veganAngle(key, bag) {
  const line = mottersheadVeganLine(pick, `${key}-vegan`)
  const a = angle('vegan', line)
  if (a && isFree(a, bag)) return a
  const fresh = ['a', 'b', 'c', 'd', 'e']
    .map((slot) => angle('vegan', mottersheadVeganLine(pick, `${key}-vegan-${slot}`)))
    .filter((x) => isFree(x, bag))
  return fresh[0] || a
}

function noteAngle(bag, kinds, stems, a) {
  if (!a) return
  kinds.push(a.kind)
  stems.push(a.stem)
  bag.lines.push(a.text)
  bag.kinds.push(a.kind)
  bag.stems.push(a.stem)
}

function watchPlayer(side) {
  return [...(side?.keys || [])]
    .filter((k) => k?.name)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))[0] || null
}

function previewBothLines(m) {
  const home = m?.home
  const away = m?.away
  const out = []
  if (home?.name && away?.name && m?.bookie?.home && m?.bookie?.away) {
    out.push(
      `The book has ${shortTeam(home.name)} at ${m.bookie.home} and ${shortTeam(away.name)} at ${m.bookie.away}`,
    )
  }
  if (home?.name && away?.name && Number.isFinite(m?.odds?.home) && Number.isFinite(m?.odds?.away)) {
    out.push(
      `${shortTeam(home.name)} sit at ${Math.round(m.odds.home)}% on the board, ${shortTeam(away.name)} at ${Math.round(m.odds.away)}%`,
    )
  }
  const hp = predFor(m, home)
  const ap = predFor(m, away)
  if (home?.name && away?.name && Number.isFinite(hp) && Number.isFinite(ap)) {
    out.push(
      `The engine has ${shortTeam(home.name)} at ${hp} and ${shortTeam(away.name)} at ${ap}`,
    )
  }
  if (!out.length && home?.name && away?.name) {
    out.push(`${shortTeam(home.name)} against ${shortTeam(away.name)} is the week's card`)
  }
  return out
}

function previewSideHooks(side) {
  if (!side) return []
  const out = []
  const pickup = pickupBits(side)[0]
  if (pickup?.name) {
    out.push(
      angle(
        'waiver',
        `${who(side)} claimed ${pickup.name} on the ${pickupKind(pickup.kind)}`,
        { side, pickup },
      ),
    )
  }
  const watch = watchPlayer(side)
  if (watch) {
    out.push(
      angle('projected', `${who(side)}'s watch is ${watch.name} at ${watch.xp}`, {
        side,
        player: watch,
      }),
    )
  }
  if (side.titlePrice) {
    out.push(
      angle('title', `${shortTeam(side.name)} are ${side.titlePrice} for the title`, { side }),
    )
  } else if (Number.isFinite(side.titlePct)) {
    const pctLabel = formatTitlePct(side.titlePct)
    if (pctLabel) {
      out.push(
        angle('title', `${shortTeam(side.name)} sit at ${pctLabel} for the title`, { side }),
      )
    }
  }
  return out.filter(Boolean)
}

function pickPreviewHook(angles, bag, key, avoidKind) {
  const unusedKind = angles.filter(
    (a) => isFree(a, bag) && a.kind !== avoidKind,
  )
  const pool = unusedKind.length
    ? unusedKind
    : angles.filter((a) => isFree(a, bag))
  if (!pool.length) return angles.find((a) => !overlaps(a.text, bag.lines)) || null
  return pick(pool, key)
}

function _previewPersonality(m, used) {
  const key = fixtureKey(m, true)
  const bag = usedBag(used)
  const mottOn =
    isMottershead(m?.home?.manager) || isMottershead(m?.away?.manager)
  const kinds = []
  const stems = []
  const lines = []

  const both = previewBothLines(m)
    .map((t) => angle('preview', t, { side: m.home, opp: m.away }))
    .filter((a) => a && !overlaps(a.text, bag.lines))
  const unusedBoth = both.filter((a) => !bag.stems.includes(a.stem))
  const leadPool = unusedBoth.length ? unusedBoth : both
  const lead = leadPool.length ? pick(leadPool, `${key}-lead`) : null
  if (lead) {
    lines.push(lead.text)
    noteAngle(bag, kinds, stems, lead)
  }

  const homeHook = pickPreviewHook(
    previewSideHooks(m.home),
    bag,
    `${key}-hh`,
  )
  const awayHook = pickPreviewHook(
    previewSideHooks(m.away),
    bag,
    `${key}-ah`,
    homeHook?.kind,
  )
  for (const hook of [homeHook, awayHook]) {
    if (!hook || overlaps(hook.text, lines)) continue
    lines.push(hook.text)
    noteAngle(bag, kinds, stems, hook)
  }

  const vegan = mottOn ? veganAngle(key, bag) : null
  if (vegan) {
    if (!lines.length) {
      lines.push(vegan.text)
      noteAngle(bag, kinds, stems, vegan)
    } else if (pick(['aside', 'aside', 'lead'], `${key}-vegan-slot`) === 'lead') {
      lines.unshift(vegan.text)
      noteAngle(bag, kinds, stems, vegan)
    } else {
      lines.push(vegan.text)
      noteAngle(bag, kinds, stems, vegan)
    }
  }

  const jokeSides = [m?.home, m?.away].filter(
    (s) => s?.manager && !isMottershead(s.manager),
  )
  const jokeSide =
    jokeSides.length > 1 ? pick(jokeSides, `${key}-jside`) : jokeSides[0]
  const joke = jokeAngle(jokeSide, `${key}-joke`, bag)
  if (joke && lines.length < 4) {
    lines.push(joke.text)
    noteAngle(bag, kinds, stems, joke)
  }

  if (lines.length < 3) {
    for (const extra of both) {
      if (lines.length >= 3) break
      if (overlaps(extra.text, lines)) continue
      lines.push(extra.text)
      noteAngle(bag, kinds, stems, extra)
    }
  }

  const out = lines.slice(0, 4)
  out.kinds = kinds
  out.stems = stems
  return out
}

/**
 * One fact-line angle per card (max two sentences). Mottershead vegan is
 * required as sentence 2. Other lore is rare. Recaps and previews both
 * name both teams.
 */
export function personalityRecap(m, preview = false, used = [], ctx = {}) {
  const bag = hydrateUsedBag(used, preview, m?.gw)
  const surface = preview ? 'preview' : 'recap'
  const result = generateMatchupBlurb(m, {
    surface,
    gwContext: bag._gwContext,
    state: bag._state,
    site: ctx?.site || null,
  })
  rememberBlurb(bag, result)
  if (used && !Array.isArray(used)) {
    used.lines = bag.lines
    used.kinds = bag.kinds
    used.stems = bag.stems
    used._gwContext = bag._gwContext
    used._state = bag._state
  }
  return decoratePersonality(result)
}

function formatTitlePct(n) {
  if (!Number.isFinite(n)) return null
  const rounded = Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1)
  return `${rounded}%`
}

function titleOddsTile(side) {
  const name = squareTeam(side?.name)
  const after = side?.titleOdds?.after
  const before = side?.titleOdds?.before
  const pct = Number.isFinite(after) ? after : side?.titlePct
  const value = formatTitlePct(pct) || side?.titlePrice
  if (!name || value == null || value === '') return null
  let tone = 'neutral'
  if (Number.isFinite(after) && Number.isFinite(before)) {
    if (after > before + 0.15) tone = 'win'
    else if (after < before - 0.15) tone = 'loss'
  }
  return tile(name, value, 'title', tone)
}

function recapStatTiles(m) {
  const fav = favSide(m)
  const whoFor = shortTeam(fav?.name)
  const call =
    m?.odds?.outcome === 'miss'
      ? tile('Model', 'Wrong', whoFor, 'loss')
      : m?.odds?.outcome === 'hit'
        ? tile('Model', 'Right', whoFor, 'win')
        : tile('Model', whoFor, 'pre-match')

  const tops = [m?.home?.players?.top, m?.away?.players?.top].filter((p) => p?.name)
  const best = [...tops].sort((a, b) => (b.pts || 0) - (a.pts || 0))[0]
  const star = tile('Top scorer', best?.pts, best?.name)

  return [call, star, titleOddsTile(m?.home), titleOddsTile(m?.away)].filter(Boolean)
}

function squareTeam(name) {
  const s = shortTeam(name)
  if (!s || s === '–') return s
  if (/^msfg$/i.test(s)) return s
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length > 1 && /^(atl[eé]tico|fc|afc|the)$/i.test(parts[0])) {
    return parts[1]
  }
  return parts[0]
}

function previewStatTiles(m) {
  const fav = m?.odds?.favoriteSide
  const home = tile(
    squareTeam(m?.home?.name),
    m?.bookie?.home,
    '',
    fav === 'home' ? 'win' : 'neutral',
  )
  const away = tile(
    squareTeam(m?.away?.name),
    m?.bookie?.away,
    '',
    fav === 'away' ? 'win' : 'neutral',
  )
  const watch = [m?.home?.keys?.[0], m?.away?.keys?.[0]]
    .filter((k) => k?.name)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))[0]
  const eye = tile('Top scorer', watch?.xp, watch?.name)

  return [home, away, eye].filter(Boolean)
}

export function fixtureStatTiles(m, { preview = false } = {}) {
  return preview ? previewStatTiles(m) : recapStatTiles(m)
}

function recapBullets(m, used) {
  const out = []
  const key = fixtureKey(m, false)
  const winner =
    m?.winner === m?.home?.entryId
      ? m.home
      : m?.winner === m?.away?.entryId
        ? m.away
        : null
  const loser =
    winner && winner.entryId === m?.home?.entryId ? m.away : winner ? m.home : null

  if (Number.isFinite(m?.margin) && m.margin >= 15 && winner) {
    out.push(
      pick(
        [
          `${m.margin} points — the kind of scoreline that gets screenshotted`,
          `${shortTeam(winner.name)} by ${m.margin}, and it never looked like a scrap`,
        ],
        `${key}-margin`,
      ),
    )
  } else if (Number.isFinite(m?.margin) && m.margin <= 5 && winner) {
    out.push(`Decided by ${m.margin} — one bad bench call from a draw`)
  }

  const titleSwing = [m?.home, m?.away]
    .map((s) => {
      const before = s?.titleOdds?.before
      const after = s?.titleOdds?.after
      if (!Number.isFinite(before) || !Number.isFinite(after)) return null
      return { name: s.name, delta: after - before, after }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  if (titleSwing && Math.abs(titleSwing.delta) >= 1.5) {
    const dir = titleSwing.delta > 0 ? 'up' : 'down'
    out.push(
      `${shortTeam(titleSwing.name)} ${dir} to ${titleSwing.after.toFixed(1)}% for the title`,
    )
  }

  const pickup = [m?.home?.pickup, m?.away?.pickup].find((p) => p?.name)
  if (pickup) {
    const kind = pickup.kind === 'f' ? 'free-agent' : 'waiver'
    out.push(
      `${pickup.name} the ${kind} paid ${pickup.pts != null ? pickup.pts : 'a visit'}`,
    )
  }

  if (winner?.isWeekHigh) {
    out.push(`${shortTeam(winner.name)} posted the week high`)
  } else if (loser && winner) {
    out.push(
      pick(
        [
          `${who(loser)} will be talking about the one that got away`,
          `${shortTeam(loser.name)} never found a second gear`,
        ],
        `${key}-loser`,
      ),
    )
  }

  return out.filter((b) => !overlaps(b, used)).slice(0, 2)
}

function previewBullets(m, used) {
  const out = []
  const sentences = (m?.sentences || []).map(stripEnd)
  const hinge = sentences.find((s) =>
    /hinge|path is ugly|need .+ to haul|to blank/i.test(s),
  )
  if (hinge) out.push(hinge)

  const claims = sentences.find(
    (s) => /claimed|added /i.test(s) && !sameLine(s, hinge),
  )
  if (claims) out.push(claims)

  const fav = favSide(m)
  const bookPrice =
    m?.odds?.favoriteSide === 'away' ? m?.bookie?.away : m?.bookie?.home
  if (bookPrice && fav && out.length < 2) {
    out.push(`The book makes ${shortTeam(fav.name)} a ${bookPrice} favourite`)
  }

  const title = [m?.home, m?.away]
    .filter((s) => s?.titlePrice)
    .sort((a, b) => (b.titlePct || 0) - (a.titlePct || 0))[0]
  if (title && out.length < 2) {
    out.push(
      `The title board still has ${shortTeam(title.name)} out in front at ${title.titlePrice}`,
    )
  }

  const watch = [m?.home?.keys?.[0], m?.away?.keys?.[0]].filter((k) => k?.name)
  if (watch.length === 2 && out.length < 2) {
    out.push(
      `${watch[0].name} ${watch[0].xp} against ${watch[1].name} ${watch[1].xp} is the hinge`,
    )
  }

  return out.filter((b) => !overlaps(b, used)).slice(0, 2)
}

export function interestingBullets(m, { preview = false, used = [] } = {}) {
  const raw = preview ? previewBullets(m, used) : recapBullets(m, used)
  if (raw.length >= 2) return raw.slice(0, 2)

  const extra = []
  for (const s of m?.sentences || []) {
    const line = stripEnd(s)
    if (!line || TABLE_OPEN.test(line) || QUIPPY.test(line)) continue
    if (overlaps(line, [...used, ...raw, ...extra])) continue
    extra.push(line)
    if (raw.length + extra.length >= 2) break
  }
  return [...raw, ...extra].slice(0, 2)
}

export function glanceFixture(m, { preview = false, used = [], priorGws = [], site = null } = {}) {
  const recap = personalityRecap(m, preview, used, { priorGws, site })
  const stats = fixtureStatTiles(m, { preview })
  return {
    stats,
    bullets: [],
    recap,
    kinds: recap.kinds || [],
    stems: recap.stems || [],
  }
}

function tile(label, value, sub, tone) {
  if (value == null || value === '') return null
  return { label, value: String(value), sub: sub || '', tone: tone || 'neutral' }
}

function highestPredicted(previewGw) {
  const baked = previewGw?.superlatives?.topScorer
  if (baked?.name) return baked
  let best = null
  for (const m of previewGw?.matchups || []) {
    for (const k of [m?.home?.keys?.[0], m?.away?.keys?.[0]]) {
      if (!k?.name) continue
      if (!best || (k.xp || 0) > (best.xp || 0)) best = k
    }
  }
  return best
}

function formatWinPct(n) {
  if (!Number.isFinite(Number(n))) return null
  return `${Math.round(Number(n))}%`
}

function favouriteFromMatchups(previewGw) {
  const baked = previewGw?.superlatives?.favourite
  if (baked?.name && Number.isFinite(Number(baked.pct))) {
    return { name: baked.name, pct: Number(baked.pct) }
  }
  let best = null
  for (const m of previewGw?.matchups || []) {
    const side = m?.odds?.favoriteSide === 'away' ? m.away : m?.odds?.favoriteSide === 'home' ? m.home : null
    const pct = Number(m?.odds?.favoritePct)
    if (!side?.name || !Number.isFinite(pct)) continue
    if (!best || pct > best.pct) best = { name: side.name, pct }
  }
  return best
}

function underdogFromMatchups(previewGw) {
  const baked = previewGw?.superlatives?.underdog
  if (baked?.name && Number.isFinite(Number(baked.pct))) {
    return { name: baked.name, pct: Number(baked.pct) }
  }
  let worst = null
  for (const m of previewGw?.matchups || []) {
    for (const [side, raw] of [
      [m?.home, m?.odds?.home],
      [m?.away, m?.odds?.away],
    ]) {
      const pct = Number(raw)
      if (!side?.name || !Number.isFinite(pct)) continue
      if (!worst || pct < worst.pct) worst = { name: side.name, pct }
    }
  }
  return worst
}

function modelDots(recapGw) {
  const calls = (recapGw?.model?.calls || []).filter(
    (c) => c.outcome === 'hit' || c.outcome === 'miss',
  )
  let dots = calls.map((c) => (c.outcome === 'hit' ? 'win' : 'loss'))
  if (!dots.length) {
    const hits = Number(recapGw?.model?.hits) || 0
    const misses = Number(recapGw?.model?.misses) || 0
    if (hits + misses === 0) return []
    dots = [...Array(hits).fill('win'), ...Array(misses).fill('loss')]
  }
  return dots
}

function modelTile(recapGw) {
  const dots = modelDots(recapGw)
  if (!dots.length) return null
  const right = dots.filter((d) => d === 'win').length
  return {
    label: 'Model',
    value: `${right}/${dots.length}`,
    sub: `${right}/${dots.length}`,
    tone: 'neutral',
    dots,
  }
}

export function glanceTiles({ recapGw, previewGw, preview }) {
  const s = (preview ? previewGw?.superlatives : recapGw?.superlatives) || {}
  const predicted = preview ? highestPredicted(previewGw) : null
  const scorer = preview
    ? tile(
        'Top scorer',
        predicted?.xp ?? predicted?.pts ?? predicted?.name ?? null,
        predicted?.name,
        'win',
      )
    : tile('GW scorer', s.weekHigh?.points, shortTeam(s.weekHigh?.name), 'win')
  if (preview) {
    const fav = favouriteFromMatchups(previewGw)
    const dog = underdogFromMatchups(previewGw)
    return [
      tile('Biggest fav', formatWinPct(fav?.pct), shortTeam(fav?.name), 'win'),
      tile(
        'Biggest underdog',
        formatWinPct(dog?.pct),
        shortTeam(dog?.name),
      ),
      scorer,
      tile(
        'Best waiver',
        s.bestWaiver?.xp ?? s.bestWaiver?.pts,
        s.bestWaiver?.name,
      ),
      tile(
        'Potential dud',
        s.dud?.xp ?? s.dud?.pts,
        s.dud
          ? `${s.dud.name}${s.dud.overallPick ? ` · pick ${s.dud.overallPick}` : ''}`
          : '',
        'loss',
      ),
    ].filter(Boolean)
  }
  return [
    scorer,
    tile(
      'Best waiver',
      s.bestWaiver?.pts ?? s.bestWaiver?.xp,
      s.bestWaiver?.name,
    ),
    tile(
      'Dud',
      s.dud?.pts ?? s.dud?.xp,
      s.dud
        ? `${s.dud.name}${s.dud.overallPick ? ` · pick ${s.dud.overallPick}` : ''}`
        : '',
      'loss',
    ),
    modelTile(recapGw),
    tile('Top scorer', s.starPlayer?.pts, s.starPlayer?.name),
  ].filter(Boolean)
}

export function wrapBanner(sentences) {
  const first = (sentences || []).find(Boolean)
  return first ? stripEnd(first) : null
}
