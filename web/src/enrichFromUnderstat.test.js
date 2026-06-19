import test from 'node:test';
import assert from 'node:assert/strict';
import {
  understatTeamIndex,
  enrichTeamWithUnderstat,
  understatPlayerIndex,
  matchUnderstatPlayer,
  blendPlayerXgXa,
} from './enrichFromUnderstat.js';

const baseTeam = {
  id: 1,
  name: 'Arsenal',
  xGForPer90: 1.15,
  xGAgainstPer90: 1.15,
  goalsForPer90: 1.15,
  goalsAgainstPer90: 1.15,
  shotsForPer90: 12,
  shotsAgainstPer90: 12,
  cleanSheetRate: 0.28,
  homeAttackStrength: 1.05,
  awayAttackStrength: 0.95,
  homeDefenceStrength: 1.05,
  awayDefenceStrength: 0.95,
};

test('understatTeamIndex keys by canonical name + computes league avg', () => {
  const u = {
    teams: {
      a: { title: 'Arsenal', xGFor: 2.0 },
      b: { title: 'Manchester City', xGFor: 1.0 },
    },
  };
  const { byKey, leagueAvgXGFor } = understatTeamIndex(u);
  assert.ok(byKey.has('arsenal'));
  assert.ok(byKey.has('mancity'));
  assert.equal(leagueAvgXGFor, 1.5);
});

test('enrichTeamWithUnderstat overrides absolutes and sets clamped split ratios', () => {
  const agg = {
    title: 'Arsenal',
    xGFor: 1.8,
    xGAgainst: 0.9,
    goalsFor: 2.0,
    goalsAgainst: 0.8,
    cleanSheetRate: 0.5,
    home: { xGFor: 2.16, xGAgainst: 0.72 }, // 1.2x and 0.8x of overall
    away: { xGFor: 1.44, xGAgainst: 1.08 }, // 0.8x and 1.2x of overall
  };
  const { team, enriched } = enrichTeamWithUnderstat(baseTeam, agg);
  assert.equal(enriched, true);
  assert.equal(team.xGForPer90, 1.8);
  assert.equal(team.xGAgainstPer90, 0.9);
  assert.equal(team.cleanSheetRate, 0.5);
  assert.ok(Math.abs(team.homeAttackStrength - 1.2) < 1e-9);
  assert.ok(Math.abs(team.awayAttackStrength - 0.8) < 1e-9);
  assert.ok(Math.abs(team.homeDefenceStrength - 0.8) < 1e-9);
  assert.ok(Math.abs(team.awayDefenceStrength - 1.2) < 1e-9);
});

test('enrichTeamWithUnderstat clamps extreme splits to [0.7,1.3]', () => {
  const agg = { title: 'X', xGFor: 1.0, xGAgainst: 1.0, home: { xGFor: 3.0, xGAgainst: 0.1 }, away: { xGFor: 0.1, xGAgainst: 3.0 } };
  const { team } = enrichTeamWithUnderstat(baseTeam, agg);
  assert.equal(team.homeAttackStrength, 1.3);
  assert.equal(team.awayAttackStrength, 0.7);
  assert.equal(team.homeDefenceStrength, 0.7);
  assert.equal(team.awayDefenceStrength, 1.3);
});

test('enrichTeamWithUnderstat is a no-op without an aggregate', () => {
  const { team, enriched } = enrichTeamWithUnderstat(baseTeam, null);
  assert.equal(enriched, false);
  assert.equal(team, baseTeam);
});

test('player index + matching bridges web_name vs Understat full name', () => {
  const understat = {
    players: [
      { name: 'Mohamed Salah', nameKey: 'mohamedsalah', team: 'Liverpool', teamKey: 'liverpool', minutes: 3000, xG90: 0.6, xA90: 0.3 },
      { name: 'Bruno Fernandes', nameKey: 'brunofernandes', team: 'Manchester United', teamKey: 'manutd', minutes: 3000, xG90: 0.3, xA90: 0.4 },
    ],
  };
  const idx = understatPlayerIndex(understat);
  // FPL Salah: web_name "Salah", full "Mohamed Salah"
  const salah = matchUnderstatPlayer(
    { firstName: 'Mohamed', secondName: 'Salah', webName: 'Salah', teamName: 'Liverpool' },
    idx,
  );
  assert.equal(salah?.nameKey, 'mohamedsalah');
  // FPL Bruno: full "Bruno Borges Fernandes" (differs) but last name + team resolves it
  const bruno = matchUnderstatPlayer(
    { firstName: 'Bruno', secondName: 'Borges Fernandes', webName: 'B.Fernandes', teamName: 'Man Utd' },
    idx,
  );
  assert.equal(bruno?.nameKey, 'brunofernandes');
});

test('blendPlayerXgXa weights toward Understat with more minutes', () => {
  const player = { xGPer90: 0.2, xAPer90: 0.2 };
  // 900+ minutes → weight capped at 0.6
  const { player: p, weight } = blendPlayerXgXa(player, { minutes: 1800, xG90: 0.7, xA90: 0.7 });
  assert.equal(weight, 0.6);
  assert.ok(Math.abs(p.xGPer90 - (0.6 * 0.7 + 0.4 * 0.2)) < 1e-9);
  // low minutes → weight floored at 0.2
  const { weight: wLow } = blendPlayerXgXa(player, { minutes: 90, xG90: 0.7, xA90: 0.7 });
  assert.equal(wLow, 0.2);
});

test('blendPlayerXgXa falls back to FPL rate when Understat rate is zero', () => {
  const player = { xGPer90: 0.25, xAPer90: 0.1 };
  const { player: p } = blendPlayerXgXa(player, { minutes: 1800, xG90: 0, xA90: 0.5 });
  assert.equal(p.xGPer90, 0.25); // understat 0 → keep FPL
});
