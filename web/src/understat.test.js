import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalisePlayerName,
  canonicalTeamKey,
  resolveFplTeamId,
  playerPer90FromUnderstat,
  parseUnderstatPlayers,
  aggregateTeamHistory,
  parseUnderstatTeams,
} from './understat.js';

test('normalisePlayerName strips accents/punctuation/space', () => {
  assert.equal(normalisePlayerName('Erling Haaland'), 'erlinghaaland');
  assert.equal(normalisePlayerName('Heung-Min Son'), 'heungminson');
  assert.equal(normalisePlayerName('Gyökeres'), 'gyokeres');
});

test('canonicalTeamKey collapses Understat + FPL naming variants', () => {
  assert.equal(canonicalTeamKey('Manchester City'), 'mancity');
  assert.equal(canonicalTeamKey('Man City'), 'mancity');
  assert.equal(canonicalTeamKey('Wolverhampton Wanderers'), 'wolves');
  assert.equal(canonicalTeamKey('Wolves'), 'wolves');
  assert.equal(canonicalTeamKey('Tottenham'), 'spurs');
  assert.equal(canonicalTeamKey('Spurs'), 'spurs');
  assert.equal(canonicalTeamKey('Nottingham Forest'), 'nottmforest');
  assert.equal(canonicalTeamKey("Nott'm Forest"), 'nottmforest');
});

test('resolveFplTeamId maps Understat titles to FPL ids via name or short_name', () => {
  const fplTeams = [
    { id: 6, name: 'Spurs', short_name: 'TOT' },
    { id: 13, name: 'Man City', short_name: 'MCI' },
    { id: 17, name: 'Wolves', short_name: 'WOL' },
  ];
  assert.equal(resolveFplTeamId('Tottenham', fplTeams), 6);
  assert.equal(resolveFplTeamId('Manchester City', fplTeams), 13);
  assert.equal(resolveFplTeamId('Wolverhampton Wanderers', fplTeams), 17);
  assert.equal(resolveFplTeamId('Nonexistent FC', fplTeams), null);
});

test('playerPer90FromUnderstat computes per-90 rates', () => {
  const p = {
    id: '8260',
    player_name: 'Erling Haaland',
    team_title: 'Manchester City',
    position: 'F S',
    games: '35',
    time: '180', // 2 full matches → per90 factor 0.5
    goals: '4',
    assists: '0',
    npg: '3',
    xG: '5.0',
    xA: '1.0',
    npxG: '4.0',
    xGChain: '6.0',
    xGBuildup: '2.0',
    shots: '10',
    key_passes: '2',
  };
  const r = playerPer90FromUnderstat(p);
  assert.equal(r.minutes, 180);
  assert.equal(r.xG90, 2.5); // 5.0 * 90/180
  assert.equal(r.xA90, 0.5);
  assert.equal(r.shots90, 5);
  assert.equal(r.teamKey, 'mancity');
  assert.equal(r.nameKey, 'erlinghaaland');
});

test('playerPer90FromUnderstat handles zero minutes', () => {
  const r = playerPer90FromUnderstat({ id: '1', player_name: 'Sub', team_title: 'Arsenal', time: '0', xG: '0' });
  assert.equal(r.xG90, 0);
  assert.equal(r.minutes, 0);
});

test('aggregateTeamHistory averages per-match and splits home/away', () => {
  const history = [
    { h_a: 'h', xG: 2, xGA: 1, npxG: 2, npxGA: 1, scored: 2, missed: 0, ppda: { att: 200, def: 10 }, ppda_allowed: { att: 100, def: 20 }, deep: 8, deep_allowed: 4 },
    { h_a: 'a', xG: 1, xGA: 3, npxG: 1, npxGA: 3, scored: 1, missed: 2, ppda: { att: 150, def: 15 }, ppda_allowed: { att: 90, def: 30 }, deep: 4, deep_allowed: 10 },
  ];
  const agg = aggregateTeamHistory(history);
  assert.equal(agg.matches, 2);
  assert.equal(agg.xGFor, 1.5);
  assert.equal(agg.xGAgainst, 2);
  assert.equal(agg.cleanSheetRate, 0.5);
  assert.equal(agg.ppda, (20 + 10) / 2); // (200/10 + 150/15)/2 = (20+10)/2 = 15
  assert.equal(agg.home.matches, 1);
  assert.equal(agg.home.xGFor, 2);
  assert.equal(agg.away.xGAgainst, 3);
});

test('parseUnderstatPlayers / parseUnderstatTeams read getLeagueData shape', () => {
  const leagueData = {
    players: [{ id: '1', player_name: 'A', team_title: 'Arsenal', time: '90', xG: '1' }],
    teams: {
      '83': { id: '83', title: 'Manchester City', history: [{ h_a: 'h', xG: 3, xGA: 0, scored: 3, missed: 0, ppda: { att: 300, def: 10 }, ppda_allowed: { att: 50, def: 25 }, deep: 12, deep_allowed: 2 }] },
    },
  };
  const players = parseUnderstatPlayers(leagueData);
  assert.equal(players.length, 1);
  assert.equal(players[0].xG90, 1);
  const teams = parseUnderstatTeams(leagueData);
  assert.equal(teams['Manchester City'].xGFor, 3);
  assert.equal(teams['Manchester City'].cleanSheetRate, 1);
});
