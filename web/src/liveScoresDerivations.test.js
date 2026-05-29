import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeManagerForm,
  countEffectiveXiPlayersRemaining,
  dcThresholdReached,
  formatKickoffLabel,
  formatLiveMatchupMargin,
  isCleanSheetEligible,
  liveFixtureLead,
  liveGwOutcomeDot,
  liveGwProgress,
  liveMatchupMargin,
  minutesTone,
  playerLiveState,
  playerXiPillKind,
  projectedH2HPoints,
  rowsByPointsContributed,
  sortStartingXIByPosition,
  teamInitials,
} from './liveScoresDerivations.js'

test('liveFixtureLead — strict winner / tie / null branches', () => {
  assert.equal(liveFixtureLead(67, 61), 'home')
  assert.equal(liveFixtureLead(38, 52), 'away')
  assert.equal(liveFixtureLead(45, 45), 'tie')
  assert.equal(liveFixtureLead(null, 4), null)
  assert.equal(liveFixtureLead(4, null), null)
  assert.equal(liveFixtureLead(undefined, undefined), null)
  assert.equal(liveFixtureLead('not-a-number', 4), null)
})

test('dcThresholdReached — GK/DEF 10+, MID/FWD 12+, unknown false', () => {
  assert.equal(dcThresholdReached('GK', 10), true)
  assert.equal(dcThresholdReached('GK', 9), false)
  assert.equal(dcThresholdReached('GKP', 10), true)
  assert.equal(dcThresholdReached('DEF', 10), true)
  assert.equal(dcThresholdReached('DEF', 9), false)
  assert.equal(dcThresholdReached('MID', 12), true)
  assert.equal(dcThresholdReached('MID', 11), false)
  assert.equal(dcThresholdReached('FWD', 12), true)
  assert.equal(dcThresholdReached('FWD', 11), false)
  assert.equal(dcThresholdReached('MNG', 99), false)
  assert.equal(dcThresholdReached(null, 99), false)
  assert.equal(dcThresholdReached('def', 10), true, 'case-insensitive position')
  assert.equal(dcThresholdReached('FWD', null), false)
})

test('playerXiPillKind — maps ESPN matchday role; defaults to xi', () => {
  assert.equal(playerXiPillKind({ espnMatchdayRole: 'xi' }), 'xi')
  assert.equal(playerXiPillKind({ espnMatchdayRole: 'bench' }), 'bench')
  assert.equal(playerXiPillKind({ espnMatchdayRole: 'absent' }), 'absent')
  assert.equal(playerXiPillKind({ espnMatchdayRole: null }), 'xi')
  assert.equal(playerXiPillKind({}), 'xi')
  assert.equal(playerXiPillKind(null), 'xi')
})

test('playerLiveState — on pitch shows red minute counter', () => {
  const out = playerLiveState({
    minutes: 47,
    clubGwFixturesFinished: false,
    hasGwFixture: true,
  })
  assert.equal(out.kind, 'live')
  assert.equal(out.text, "47'")
})

test('playerLiveState — FT when club finished and played', () => {
  const out = playerLiveState({
    minutes: 90,
    clubGwFixturesFinished: true,
    hasGwFixture: true,
  })
  assert.equal(out.kind, 'ft')
  assert.equal(out.text, 'FT')
})

test('playerLiveState — DNP when club finished and 0 minutes', () => {
  const out = playerLiveState({
    minutes: 0,
    clubGwFixturesFinished: true,
    hasGwFixture: true,
  })
  assert.equal(out.kind, 'dnp')
  assert.equal(out.text, 'DNP')
})

test('playerLiveState — pre-kickoff uses kickoff label when available', () => {
  const out = playerLiveState({
    minutes: 0,
    clubGwFixturesFinished: false,
    hasGwFixture: true,
    kickoffLabel: 'Sat 16:30',
  })
  assert.equal(out.kind, 'pre')
  assert.equal(out.text, 'Sat 16:30')
})

test('playerLiveState — blank-week club shows dash', () => {
  const out = playerLiveState({
    minutes: 0,
    clubGwFixturesFinished: false,
    hasGwFixture: false,
  })
  assert.equal(out.kind, 'none')
  assert.equal(out.text, '—')
})

test('formatKickoffLabel — same day drops weekday', () => {
  const now = new Date('2026-03-08T10:00:00Z')
  const label = formatKickoffLabel('2026-03-08T16:30:00Z', now)
  assert.ok(label, 'expected a non-null label')
  // Same-day label is just HH:MM. No assumption about the host TZ — but it
  // should never contain a 3-letter weekday prefix on the same calendar day.
  assert.ok(!/^[A-Z][a-z]{2}\s/.test(label), `same-day label "${label}" should drop weekday`)
})

test('formatKickoffLabel — different day shows weekday', () => {
  const now = new Date('2026-03-07T10:00:00Z')
  const label = formatKickoffLabel('2026-03-08T16:30:00Z', now)
  assert.ok(label, 'expected a non-null label')
  // We only check that the label has a leading weekday-like token —
  // the rest depends on the host locale / timezone offset.
  assert.ok(/^[A-Z][a-z]{2}\s/.test(label), `cross-day label "${label}" should start with weekday`)
})

test('formatKickoffLabel — invalid / missing returns null', () => {
  assert.equal(formatKickoffLabel(null), null)
  assert.equal(formatKickoffLabel(''), null)
  assert.equal(formatKickoffLabel('not-a-date'), null)
})

test('rowsByPointsContributed — descending by points; ties broken by mins/pickPosition', () => {
  const rows = [
    { pickPosition: 1, total_points: 4, minutes: 90 },
    { pickPosition: 2, total_points: 18, minutes: 67 },
    { pickPosition: 3, total_points: 0, minutes: 0 },
    { pickPosition: 4, total_points: 4, minutes: 70 }, // ties with #1 on pts
  ]
  const sorted = rowsByPointsContributed(rows).map((r) => r.pickPosition)
  assert.deepEqual(sorted, [2, 1, 4, 3])
})

test('liveGwProgress — counts finished + finished_provisional, slash label', () => {
  const out = liveGwProgress([
    { finished: true },
    { finished: false, finished_provisional: true },
    { finished: false },
    { finished: false },
  ])
  assert.deepEqual(out, { done: 2, total: 4, label: '2/4 done' })
})

test('liveGwProgress — 0 done renders 0/N', () => {
  const out = liveGwProgress([{ finished: false }, { finished: false }])
  assert.deepEqual(out, { done: 0, total: 2, label: '0/2 done' })
})

test('liveGwProgress — empty / null returns null', () => {
  assert.equal(liveGwProgress([]), null)
  assert.equal(liveGwProgress(null), null)
  assert.equal(liveGwProgress(undefined), null)
})

test('minutesTone — 5-bucket tinting matches mockup minTone', () => {
  assert.equal(minutesTone(90), 'full')
  assert.equal(minutesTone(89), 'full')
  assert.equal(minutesTone(88), 'good')
  assert.equal(minutesTone(60), 'good')
  assert.equal(minutesTone(59), 'partial')
  assert.equal(minutesTone(30), 'partial')
  assert.equal(minutesTone(29), 'low')
  assert.equal(minutesTone(1), 'low')
  assert.equal(minutesTone(0), 'none')
  assert.equal(minutesTone(null), 'none')
  assert.equal(minutesTone(45, false), 'none', 'played=false forces none')
})

test('teamInitials — words → first letters; single word → first 2', () => {
  assert.equal(teamInitials('Crouch End Oashisu'), 'CE')
  assert.equal(teamInitials('Toronto'), 'TO')
  assert.equal(teamInitials(''), '?')
  assert.equal(teamInitials(null), '?')
})

test('isCleanSheetEligible — GK/DEF/MID true; FWD / unknown false', () => {
  assert.equal(isCleanSheetEligible('GK'), true)
  assert.equal(isCleanSheetEligible('GKP'), true)
  assert.equal(isCleanSheetEligible('DEF'), true)
  assert.equal(isCleanSheetEligible('MID'), true)
  assert.equal(isCleanSheetEligible('FWD'), false, 'FWDs score 0 CS pts')
  assert.equal(isCleanSheetEligible('def'), true, 'case-insensitive position')
  assert.equal(isCleanSheetEligible('MNG'), false, 'manager position has no CS dot')
  assert.equal(isCleanSheetEligible(''), false)
  assert.equal(isCleanSheetEligible(null), false)
  assert.equal(isCleanSheetEligible(undefined), false)
})

test('sortStartingXIByPosition — GK→DEF→MID→FWD, points desc within group', () => {
  // Mixed XI: GK + 4 DEFs + 4 MIDs + 2 FWDs, intentionally shuffled.
  const xi = [
    { pickPosition: 8, posSingular: 'MID', total_points: 14, minutes: 90 },
    { pickPosition: 11, posSingular: 'FWD', total_points: 12, minutes: 90 },
    { pickPosition: 2, posSingular: 'DEF', total_points: 6, minutes: 90 },
    { pickPosition: 1, posSingular: 'GKP', total_points: 7, minutes: 90 },
    { pickPosition: 10, posSingular: 'FWD', total_points: 2, minutes: 90 },
    { pickPosition: 3, posSingular: 'DEF', total_points: 4, minutes: 90 },
    { pickPosition: 5, posSingular: 'DEF', total_points: 1, minutes: 88 },
    { pickPosition: 6, posSingular: 'MID', total_points: 6, minutes: 90 },
    { pickPosition: 7, posSingular: 'MID', total_points: 2, minutes: 84 },
    { pickPosition: 9, posSingular: 'MID', total_points: 2, minutes: 17 },
    { pickPosition: 4, posSingular: 'DEF', total_points: 6, minutes: 90 },
  ]
  const ordered = sortStartingXIByPosition(xi)
  // 1 GK, then 4 DEFs, then 4 MIDs, then 2 FWDs — positions in order.
  const positionsOrdered = ordered.map((r) => r.posSingular)
  assert.deepEqual(
    positionsOrdered,
    ['GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  )
  // Within DEF: points desc, then pickPosition asc for the two 6-pt rows.
  const defs = ordered.filter((r) => r.posSingular === 'DEF')
  assert.deepEqual(
    defs.map((r) => r.pickPosition),
    [2, 4, 3, 5],
    'DEF order: 6pts (pick 2) → 6pts (pick 4) → 4pts → 1pt',
  )
  // Within MID: 14 → 6 → 2 (pick 7) → 2 (pick 9).
  const mids = ordered.filter((r) => r.posSingular === 'MID')
  assert.deepEqual(
    mids.map((r) => r.pickPosition),
    [8, 6, 7, 9],
    'MID order: 14pts → 6pts → 2pts (pick 7) → 2pts (pick 9)',
  )
})

test('sortStartingXIByPosition — empty / null / unknown positions tolerated', () => {
  assert.deepEqual(sortStartingXIByPosition([]), [])
  assert.deepEqual(sortStartingXIByPosition(null), [])
  assert.deepEqual(sortStartingXIByPosition(undefined), [])
  // Unknown positions sort to the tail rather than break the spine.
  const out = sortStartingXIByPosition([
    { pickPosition: 2, posSingular: 'MNG', total_points: 99 },
    { pickPosition: 1, posSingular: 'FWD', total_points: 1 },
  ])
  assert.deepEqual(
    out.map((r) => r.posSingular),
    ['FWD', 'MNG'],
  )
})

test('sortStartingXIByPosition — case-insensitive position label', () => {
  const out = sortStartingXIByPosition([
    { pickPosition: 2, posSingular: 'fwd', total_points: 3 },
    { pickPosition: 1, posSingular: 'def', total_points: 1 },
  ])
  assert.deepEqual(
    out.map((r) => r.pickPosition),
    [1, 2],
    'lowercase def should sort before lowercase fwd',
  )
})

/** Shared schedule fixture used by the `computeManagerForm` tests below.
 * Manager 1 (`leagueEntryId: 1`) has finished W/L/D/W/L across GW 32-36 and
 * is paired against id 9 in the live GW 37. Manager 2 (`leagueEntryId: 2`)
 * only has 2 finished GWs to exercise the left-padding behaviour. */
const FORM_FIXTURE_MATCHES = [
  // GW 32 — id 1 beats id 5 (W)
  { event: 32, finished: true, league_entry_1: 1, league_entry_2: 5, league_entry_1_points: 70, league_entry_2_points: 55 },
  // GW 33 — id 1 loses to id 6 (L)
  { event: 33, finished: true, league_entry_1: 6, league_entry_2: 1, league_entry_1_points: 80, league_entry_2_points: 60 },
  // GW 34 — id 1 draws id 7 (D)
  { event: 34, finished: true, league_entry_1: 1, league_entry_2: 7, league_entry_1_points: 65, league_entry_2_points: 65 },
  // GW 35 — id 1 beats id 8 (W)
  { event: 35, finished: true, league_entry_1: 8, league_entry_2: 1, league_entry_1_points: 50, league_entry_2_points: 72 },
  // GW 36 — id 1 loses to id 9 (L)
  { event: 36, finished: true, league_entry_1: 1, league_entry_2: 9, league_entry_1_points: 40, league_entry_2_points: 61 },
  // GW 37 — live, both sides; we'll pass liveMy/liveOpp explicitly
  { event: 37, finished: false, league_entry_1: 1, league_entry_2: 9, league_entry_1_points: 0, league_entry_2_points: 0 },
  // Manager 2 — only 2 finished GWs (34 win, 36 loss); the helper should pad on the left
  { event: 34, finished: true, league_entry_1: 2, league_entry_2: 5, league_entry_1_points: 72, league_entry_2_points: 50 },
  { event: 36, finished: true, league_entry_1: 6, league_entry_2: 2, league_entry_1_points: 70, league_entry_2_points: 55 },
]

test('computeManagerForm — 4 finished + 1 live dot, ordered oldest → newest', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 67,
    liveOppPts: 61,
  })
  assert.equal(out.length, 5, 'always 5 dots by default')
  assert.deepEqual(
    out.map((d) => ({ gw: d.gw, result: d.result, isLive: d.isLive })),
    [
      { gw: 33, result: 'L', isLive: false },
      { gw: 34, result: 'D', isLive: false },
      { gw: 35, result: 'W', isLive: false },
      { gw: 36, result: 'L', isLive: false },
      { gw: 37, result: 'W', isLive: true },
    ],
  )
})

test('computeManagerForm — finished entries carry per-dot myScore/oppScore/oppLeagueEntry for tooltips', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 67,
    liveOppPts: 61,
  })
  /** GW 33: id 1 was league_entry_2, lost 60-80 to id 6. */
  assert.deepEqual(
    { ...out[0], gw: out[0].gw, isLive: out[0].isLive },
    {
      gw: 33,
      result: 'L',
      isLive: false,
      myScore: 60,
      oppScore: 80,
      oppLeagueEntry: 6,
    },
  )
  /** GW 35: id 1 was league_entry_2, beat id 8 72-50. */
  assert.deepEqual(out[2], {
    gw: 35,
    result: 'W',
    isLive: false,
    myScore: 72,
    oppScore: 50,
    oppLeagueEntry: 8,
  })
})

test('computeManagerForm — live dot carries liveMy/liveOpp scores (oppLeagueEntry left to caller)', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 67,
    liveOppPts: 61,
  })
  const live = out[out.length - 1]
  assert.equal(live.gw, 37)
  assert.equal(live.myScore, 67)
  assert.equal(live.oppScore, 61)
  /** Caller knows current-GW pairing from `gwMatches` — helper leaves it null. */
  assert.equal(live.oppLeagueEntry, null)
})

test('computeManagerForm — padded slots have null myScore/oppScore/oppLeagueEntry', () => {
  const out = computeManagerForm({
    leagueEntryId: 2,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    includeLive: false,
  })
  /** First 3 slots are pad — no match data. */
  for (const d of out.slice(0, 3)) {
    assert.equal(d.result, null)
    assert.equal(d.myScore, null)
    assert.equal(d.oppScore, null)
    assert.equal(d.oppLeagueEntry, null)
  }
  /** GW 36: id 2 was league_entry_2, lost 55-70 to id 6. */
  assert.deepEqual(out[4], {
    gw: 36,
    result: 'L',
    isLive: false,
    myScore: 55,
    oppScore: 70,
    oppLeagueEntry: 6,
  })
})

test('computeManagerForm — live dot null/isLive when live points missing', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: null,
    liveOppPts: null,
  })
  const live = out[out.length - 1]
  assert.equal(live.gw, 37)
  assert.equal(live.result, null, 'no live points → muted ring on the live dot')
  assert.equal(live.isLive, true, 'still flagged as in-flight while gw not finished')
})

test('computeManagerForm — currentGwFinished collapses pulse on the 5th dot', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 67,
    liveOppPts: 61,
    currentGwFinished: true,
  })
  const last = out[out.length - 1]
  assert.equal(last.result, 'W')
  assert.equal(last.isLive, false, 'FT result is finalized → no pulse')
})

test('computeManagerForm — pads on the left when fewer than 4 finished GWs', () => {
  const out = computeManagerForm({
    leagueEntryId: 2,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 50,
    liveOppPts: 50,
  })
  assert.equal(out.length, 5)
  assert.deepEqual(
    out.map((d) => d.result),
    [null, null, 'W', 'L', 'D'],
    '2 finished GWs (W, L) tail-padded into the last 2 history slots + draw live',
  )
  assert.equal(out[0].gw, 33, 'first padding slot guesses gw=33 from gameweek-4')
  assert.equal(out[1].gw, 34, 'second padding slot guesses gw=34 from gameweek-3')
  assert.equal(out[4].isLive, true, 'live dot still flagged')
})

test('computeManagerForm — ignores matches without this manager and unfinished history', () => {
  const out = computeManagerForm({
    leagueEntryId: 999, // not in fixtures
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 60,
    liveOppPts: 58,
  })
  assert.deepEqual(
    out.map((d) => d.result),
    [null, null, null, null, 'W'],
    'no history slots have results, but live dot is computed from live points',
  )
})

test('computeManagerForm — handles missing matches array / non-numeric id', () => {
  const out = computeManagerForm({
    leagueEntryId: null,
    matches: null,
    gameweek: 37,
    liveMyPts: 70,
    liveOppPts: 60,
  })
  assert.equal(out.length, 5)
  assert.equal(out[4].result, 'W', 'live dot still works even without history data')
  assert.deepEqual(
    out.slice(0, 4).map((d) => d.result),
    [null, null, null, null],
  )
})

test('liveMatchupMargin — signed live score margin or null', () => {
  assert.equal(liveMatchupMargin(67, 61), 6)
  assert.equal(liveMatchupMargin(40, 65), -25)
  assert.equal(liveMatchupMargin(50, 50), 0)
  assert.equal(liveMatchupMargin(null, 4), null)
  assert.equal(liveMatchupMargin(4, undefined), null)
  assert.equal(liveMatchupMargin('not-a-number', 4), null)
})

test('formatLiveMatchupMargin — `+N` for positive, signed for negative, `0`, or null', () => {
  assert.equal(formatLiveMatchupMargin(6), '+6')
  assert.equal(formatLiveMatchupMargin(0), '0')
  assert.equal(formatLiveMatchupMargin(-3), '-3')
  assert.equal(formatLiveMatchupMargin(null), null)
  assert.equal(formatLiveMatchupMargin(undefined), null)
  assert.equal(formatLiveMatchupMargin('abc'), null)
})

test('computeManagerForm — includeLive:false returns 5 historic dots, no live entry', () => {
  const out = computeManagerForm({
    leagueEntryId: 1,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    liveMyPts: 67,
    liveOppPts: 61,
    includeLive: false,
  })
  assert.equal(out.length, 5, '5 dots, all historic')
  assert.equal(
    out.every((d) => d.isLive === false),
    true,
    'no live dot when includeLive:false',
  )
  assert.deepEqual(
    out.map((d) => ({ gw: d.gw, result: d.result })),
    [
      { gw: 32, result: 'W' },
      { gw: 33, result: 'L' },
      { gw: 34, result: 'D' },
      { gw: 35, result: 'W' },
      { gw: 36, result: 'L' },
    ],
    'returns the 5 most-recently-finished GWs (oldest → newest), excludes live GW 37',
  )
})

test('computeManagerForm — includeLive:false pads on the left when fewer than 5 finished GWs', () => {
  const out = computeManagerForm({
    leagueEntryId: 2,
    matches: FORM_FIXTURE_MATCHES,
    gameweek: 37,
    includeLive: false,
  })
  assert.equal(out.length, 5)
  assert.deepEqual(
    out.map((d) => d.result),
    [null, null, null, 'W', 'L'],
    '2 finished GWs (W on 34, L on 36) tail-padded into the last 2 slots',
  )
  assert.equal(out[4].gw, 36, 'final dot is the most recent finished GW')
})

test('projectedH2HPoints — win/draw/loss/null mapping', () => {
  assert.deepEqual(projectedH2HPoints(67, 61), { value: 3, kind: 'win' })
  assert.deepEqual(projectedH2HPoints(50, 50), { value: 1, kind: 'draw' })
  assert.deepEqual(
    projectedH2HPoints(40, 65),
    { value: null, kind: 'loss' },
    'losing returns null value so caller hides the chip',
  )
  assert.equal(projectedH2HPoints(null, 4), null)
  assert.equal(projectedH2HPoints(4, undefined), null)
  assert.equal(projectedH2HPoints('not-a-number', 4), null)
})

test('liveGwOutcomeDot — kind by margin; hasGwStarted=false → none', () => {
  assert.equal(liveGwOutcomeDot(67, 61, true), 'win')
  assert.equal(liveGwOutcomeDot(40, 65, true), 'loss')
  assert.equal(liveGwOutcomeDot(50, 50, true), 'draw')
  assert.equal(liveGwOutcomeDot(0, 0, true), 'draw', '0-0 mid-GW is a draw')
  assert.equal(
    liveGwOutcomeDot(67, 61, false),
    'none',
    'hasGwStarted=false forces none even with live points loaded',
  )
  assert.equal(liveGwOutcomeDot(null, 61, true), 'none')
  assert.equal(liveGwOutcomeDot(67, null, true), 'none')
  assert.equal(liveGwOutcomeDot(undefined, undefined, true), 'none')
  assert.equal(liveGwOutcomeDot('abc', 61, true), 'none')
  assert.equal(
    liveGwOutcomeDot(67, 61),
    'win',
    'hasGwStarted defaults to true',
  )
})

test('countEffectiveXiPlayersRemaining — counts distinct starters with games left (DGW dedup, ignores 0/non-finite)', () => {
  // Empty / nullish input → 0 (no null guard needed in the renderer).
  assert.equal(countEffectiveXiPlayersRemaining(null), 0)
  assert.equal(countEffectiveXiPlayersRemaining([]), 0)

  // DGW player with 2 fixtures left counts as 1 player; 0 / negative /
  // non-finite values are skipped so the renderer can swap in the
  // "all done" indicator only when every starter is truly finished.
  const xi = [
    { playerGamesLeftToPlay: 1 },
    { playerGamesLeftToPlay: 2 },
    { playerGamesLeftToPlay: 0 },
    { playerGamesLeftToPlay: null },
    { playerGamesLeftToPlay: 'oops' },
    { playerGamesLeftToPlay: -1 },
    { playerGamesLeftToPlay: 1 },
  ]
  assert.equal(countEffectiveXiPlayersRemaining(xi), 3)

  // Whole-XI states: 0 (all done) + 11 (pre-kickoff) — sanity guards for
  // the renderer's `N === 0` branch and the upper bound.
  assert.equal(
    countEffectiveXiPlayersRemaining(
      Array.from({ length: 11 }, () => ({ playerGamesLeftToPlay: 0 })),
    ),
    0,
  )
  assert.equal(
    countEffectiveXiPlayersRemaining(
      Array.from({ length: 11 }, () => ({ playerGamesLeftToPlay: 1 })),
    ),
    11,
  )
})
