import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignCompetitionRanks,
  buildNoBonusReport,
  countedBonus,
  matchOutcome,
  scoreWithoutBonus,
} from './noBonusPoints.js'

test('countedBonus ignores the bench and doubles a captain', () => {
  const picks = [
    { element: 1, position: 1, multiplier: 1 },
    { element: 2, position: 2, multiplier: 2, is_captain: true },
    { element: 3, position: 12, multiplier: 1 },
  ]
  const bonus = { 1: 1, 2: 3, 3: 3 }
  assert.equal(countedBonus(picks, [], bonus), 7)
})

test('countedBonus follows an autosub off the bonus scorer', () => {
  const picks = [
    { element: 10, position: 1, multiplier: 1 },
    { element: 11, position: 12, multiplier: 1 },
  ]
  const subs = [{ element_out: 10, element_in: 11 }]
  assert.equal(countedBonus(picks, subs, { 10: 3, 11: 2 }), 2)
  assert.equal(countedBonus(picks, [], { 10: 3, 11: 2 }), 3)
})

test('a one-point loss flips when the winner’s bonus was the margin', () => {
  const report = buildNoBonusReport({
    teams: [
      { leagueEntryId: 1, teamName: 'Suffolk' },
      { leagueEntryId: 2, teamName: 'Brampton' },
    ],
    fixtures: [
      {
        gw: 2,
        homeId: 1,
        awayId: 2,
        homePts: 45,
        awayPts: 46,
        homeBonus: 3,
        awayBonus: 6,
      },
    ],
  })
  assert.equal(report.flippedCount, 1)
  const home = report.standings.find((r) => r.leagueEntryId === 1)
  const away = report.standings.find((r) => r.leagueEntryId === 2)
  assert.equal(home.pts, 3)
  assert.equal(home.ptsDelta, 3)
  assert.equal(home.w, 1)
  assert.equal(away.pts, 0)
  assert.equal(away.ptsDelta, -3)
  assert.equal(home.flips ? home.rank : home.rank, 1)
  const flip = report.teams.find((t) => t.leagueEntryId === 1).flips[0]
  assert.equal(flip.gw, 2)
  assert.equal(flip.opponentName, 'Brampton')
  assert.equal(flip.bonusRemoved, 3)
  assert.equal(flip.opponentBonus, 6)
  assert.equal(flip.from, 'L')
  assert.equal(flip.to, 'W')
  assert.equal(report.teams.find((t) => t.leagueEntryId === 2).flips[0].from, 'W')
})

test('unchanged results stay off the team flip list', () => {
  const report = buildNoBonusReport({
    teams: [
      { leagueEntryId: 1, teamName: 'A' },
      { leagueEntryId: 2, teamName: 'B' },
    ],
    fixtures: [
      {
        gw: 1,
        homeId: 1,
        awayId: 2,
        homePts: 51,
        awayPts: 24,
        homeBonus: 6,
        awayBonus: 0,
      },
    ],
  })
  assert.equal(report.flippedCount, 0)
  assert.equal(report.fixtures.length, 0)
  assert.deepEqual(report.teams[0].flips, [])
  assert.equal(report.teams.find((t) => t.leagueEntryId === 1).bonusRemoved, 6)
  assert.equal(report.teams.find((t) => t.leagueEntryId === 1).ptsDelta, 0)
  assert.equal(matchOutcome(45, 24), 'W')
  assert.equal(scoreWithoutBonus(51, 6), 45)
})

test('points-for tiebreak moves a rank when no result flips', () => {
  const report = buildNoBonusReport({
    teams: [
      { leagueEntryId: 1, teamName: 'Alpha' },
      { leagueEntryId: 2, teamName: 'Beta' },
      { leagueEntryId: 3, teamName: 'Gamma' },
    ],
    fixtures: [
      {
        gw: 1,
        homeId: 1,
        awayId: 3,
        homePts: 50,
        awayPts: 20,
        homeBonus: 12,
        awayBonus: 0,
      },
      {
        gw: 1,
        homeId: 2,
        awayId: 3,
        homePts: 48,
        awayPts: 10,
        homeBonus: 0,
        awayBonus: 0,
      },
    ],
  })
  assert.equal(report.flippedCount, 0)
  const alpha = report.standings.find((r) => r.leagueEntryId === 1)
  const beta = report.standings.find((r) => r.leagueEntryId === 2)
  assert.equal(alpha.nowRank, 1)
  assert.equal(beta.nowRank, 2)
  assert.equal(beta.rank, 1)
  assert.equal(alpha.rank, 2)
  assert.equal(alpha.ptsDelta, 0)
  assert.equal(alpha.changed, true)
  assert.equal(beta.changed, true)
  assert.equal(report.teams.every((t) => t.flips.length === 0), true)
})

test('tied points-for share a rank and the next rank skips', () => {
  const rows = assignCompetitionRanks([
    { pts: 3, pf: 40 },
    { pts: 3, pf: 40 },
    { pts: 3, pf: 30 },
  ])
  assert.deepEqual(
    rows.map((r) => r.rank),
    [1, 1, 3],
  )
})
