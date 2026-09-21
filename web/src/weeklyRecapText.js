/**
 * Weekly recap copy: per-fixture blurbs come from the shared engine
 * (`blurbEngine.js`). This file keeps the GW wrap plus ordinals.
 */

import {
  managerFunFact,
  uniqueDerbies,
  titanicAside,
  canonicalManager,
} from './leagueLore.js'
import { generateMatchupBlurb } from './blurbEngine.js'
import { pickFrom, variantIndex } from './variantIndex.js'

export { variantIndex }

const pick = pickFrom
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * Recap blurb for one matchup: one fact-line angle, optional voice.
 * Motty always gets a recap vegan line. Max two sentences.
 *
 * @param {{
 *   gw: number,
 *   home: object, away: object,
 *   odds: { favoriteSide: 'home'|'away', favoritePct: number } | null,
 *   leagueAvg?: number | null,
 *   h2h?: { games, homeWins, awayWins, draws } | null,
 * }} m
 * @param {{ state?: object, gwContext?: object, site?: object }} [opts]
 */
export function matchupRecapSentences(m, opts = {}) {
  return generateMatchupBlurb(m, { surface: 'recap', ...opts }).sentences
}

export function ordinal(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  const s = ['th', 'st', 'nd', 'rd']
  const mod = v % 100
  return `${v}${s[(mod - 20) % 10] || s[mod] || s[0]}`
}

/**
 * One-line derby headline for a GW, or null when no named fixtures land.
 * Used as the week wrap on previews and recaps.
 */
export function weekDerbySentence(matchups, key) {
  const names = uniqueDerbies(matchups)
  if (!names.length) return null
  if (names.length === 1) {
    return pick(
      [
        `Headline fixture was ${names[0]}, which is to say the group chat had a title before kick-off.`,
        `${capitalize(names[0])} sat in the middle of the card, as it always does when those two share a pitch.`,
      ],
      key,
    )
  }
  const last = names[names.length - 1]
  const head = names.slice(0, -1).map(capitalize).join(', ')
  return pick(
    [
      `${head} and ${last} dotted the card.`,
      `Named derbies all week: ${head} and ${last}.`,
    ],
    key,
  )
}

/**
 * Short weekly wrap: named derbies first, then an occasional last-place or
 * Titanic Duo aside. Stats still live on the matchup cards.
 *
 * @param {{ gw: number, matchups: object[] }} args
 * @returns {string[]}
 */
export function recapWeekWrapSentences({ gw, matchups }) {
  const key = `gw${gw}-wrap`
  const out = []
  const derby = weekDerbySentence(matchups, `${key}-d`)
  if (derby) out.push(derby)

  const sides = (matchups || []).flatMap((m) => [m.home, m.away]).filter((s) => s?.manager)
  const last = [...sides].sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0))[0]
  if (last && Number(last.rank) >= 7 && variantIndex(`${key}-last-gate`, 3) === 0) {
    const line = managerFunFact(last.manager, pick, `${key}-last`, ['last'])
    if (line) out.push(line)
  }

  const andy = sides.find((s) => canonicalManager(s.manager) === 'andy ward')
  const nickm = sides.find((s) => canonicalManager(s.manager) === 'nick mottershead')
  const bothSinking =
    andy &&
    nickm &&
    Number(andy.record?.l) > Number(andy.record?.w) &&
    Number(nickm.record?.l) > Number(nickm.record?.w)
  if (bothSinking && variantIndex(`${key}-titanic`, 4) === 0) {
    out.push(titanicAside(pick, `${key}-titanic-line`))
  }
  return out
}
