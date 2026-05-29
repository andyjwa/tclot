import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePulseliveEvents,
  parsePulseliveLineups,
  parsePulseliveScore,
} from './pulselivePremWindow.js';
import {
  collectPulseliveFixtures,
  dateRangeFromGwFixtures,
  findPulseliveMatchForFixture,
  harvestTeams,
  mapPulseliveTeamsToFpl,
  pickCurrentCompSeasonId,
  yyyyMmDdUtc,
} from './pulselivePremTimeline.js';

const fplTeamById = {
  1: { id: 1, name: 'Arsenal', short_name: 'ARS' },
  11: { id: 11, name: 'Manchester City', short_name: 'MCI' },
  12: { id: 12, name: 'Manchester United', short_name: 'MUN' },
  18: { id: 18, name: 'AFC Bournemouth', short_name: 'BOU' },
};

test('yyyyMmDdUtc — UTC date string', () => {
  assert.equal(yyyyMmDdUtc('2026-04-22T14:30:00Z'), '2026-04-22');
  assert.equal(yyyyMmDdUtc(null), null);
});

test('dateRangeFromGwFixtures — picks min/max UTC dates', () => {
  const gw = [
    { kickoff_time: '2026-04-22T14:30:00Z' },
    { kickoff_time: '2026-04-24T19:00:00Z' },
    { kickoff_time: '2026-04-23T11:30:00Z' },
  ];
  const r = dateRangeFromGwFixtures(gw);
  assert.deepEqual(r, { fromDate: '2026-04-22', toDate: '2026-04-24' });
});

test('dateRangeFromGwFixtures — null when no fixtures', () => {
  assert.equal(dateRangeFromGwFixtures([]), null);
  assert.equal(dateRangeFromGwFixtures([{ kickoff_time: 'garbage' }]), null);
});

test('collectPulseliveFixtures — picks home/away ids, kickoff', () => {
  const listJson = {
    content: [
      {
        id: 91234,
        kickoff: { millis: 1748458800000 },
        teams: [
          { team: { id: 10, name: 'Manchester City', club: { abbr: 'MCI' } } },
          { team: { id: 1, name: 'Arsenal', club: { abbr: 'ARS' } } },
        ],
        status: 'U',
      },
      {
        id: 91235,
        kickoff: { millis: 1748545200000 },
        teams: [
          { team: { id: 12, name: 'Manchester United', club: { abbr: 'MUN' } } },
          { team: { id: 18, name: 'AFC Bournemouth', club: { abbr: 'BOU' } } },
        ],
        status: 'U',
      },
    ],
  };
  const fixtures = collectPulseliveFixtures(listJson);
  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0].fixtureId, 91234);
  assert.equal(fixtures[0].homeId, 10);
  assert.equal(fixtures[0].awayId, 1);
  assert.equal(fixtures[0].homeAbbr, 'MCI');
  assert.equal(fixtures[0].kickoffMs, 1748458800000);
});

test('collectPulseliveFixtures — handles malformed entries', () => {
  assert.deepEqual(collectPulseliveFixtures(null), []);
  assert.deepEqual(collectPulseliveFixtures({}), []);
  assert.deepEqual(
    collectPulseliveFixtures({ content: [{ id: 1, teams: [{ team: { id: 10 } }] }] }),
    [],
  );
});

test('harvestTeams — extracts unique teams with abbr', () => {
  const listJson = {
    content: [
      {
        id: 91234,
        teams: [
          { team: { id: 10, name: 'Manchester City', shortName: 'Man City', club: { abbr: 'MCI' } } },
          { team: { id: 1, name: 'Arsenal', shortName: 'Arsenal', club: { abbr: 'ARS' } } },
        ],
      },
      {
        id: 91240,
        teams: [
          { team: { id: 10, club: { abbr: 'MCI' } } }, // dup
          { team: { id: 12, name: 'Manchester United', club: { abbr: 'MUN' } } },
        ],
      },
    ],
  };
  const teams = harvestTeams(listJson);
  assert.equal(teams.length, 3);
  const ids = teams.map((t) => t.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 10, 12]);
});

test('mapPulseliveTeamsToFpl — abbr-direct mapping', () => {
  const pulseTeams = [
    { id: 10, name: 'Manchester City', shortName: 'Man City', abbr: 'MCI' },
    { id: 1, name: 'Arsenal', shortName: 'Arsenal', abbr: 'ARS' },
    { id: 99, name: 'Madrid', abbr: 'MAD' }, // not in FPL
  ];
  const m = mapPulseliveTeamsToFpl(fplTeamById, pulseTeams);
  assert.equal(m.get(10), 11);
  assert.equal(m.get(1), 1);
  assert.equal(m.has(99), false);
});

test('mapPulseliveTeamsToFpl — name fallback when abbr missing', () => {
  const pulseTeams = [
    { id: 60, name: 'Bournemouth', shortName: 'Bournemouth', abbr: '' },
  ];
  const m = mapPulseliveTeamsToFpl(fplTeamById, pulseTeams);
  assert.equal(m.get(60), 18);
});

test('pickCurrentCompSeasonId — picks Aug-onwards season for a kickoff in that range', () => {
  const seasonsJson = {
    content: [
      { id: 777, label: '2025/26' },
      { id: 719, label: '2024/25' },
      { id: 578, label: '2023/24' },
    ],
  };
  /** Sept 2025 kickoff → 2025/26 season. */
  const sep25 = Date.parse('2025-09-15T15:00:00Z');
  assert.equal(pickCurrentCompSeasonId(seasonsJson, sep25), 777);
  /** Mar 2026 kickoff is still in 2025/26 (Aug 2025 → May 2026). */
  const mar26 = Date.parse('2026-03-10T20:00:00Z');
  assert.equal(pickCurrentCompSeasonId(seasonsJson, mar26), 777);
  /** Apr 2025 kickoff → 2024/25 season (Aug 2024 → May 2025). */
  const apr25 = Date.parse('2025-04-10T20:00:00Z');
  assert.equal(pickCurrentCompSeasonId(seasonsJson, apr25), 719);
});

test('pickCurrentCompSeasonId — falls back to first (latest) when kickoff unmatched or missing', () => {
  const seasonsJson = {
    content: [
      { id: 777, label: '2025/26' },
      { id: 719, label: '2024/25' },
    ],
  };
  assert.equal(pickCurrentCompSeasonId(seasonsJson, null), 777);
  /** Unknown season label → latest still wins. */
  const oldEra = Date.parse('1985-09-15T15:00:00Z');
  assert.equal(pickCurrentCompSeasonId(seasonsJson, oldEra), 777);
});

test('pickCurrentCompSeasonId — null on empty / malformed payload', () => {
  assert.equal(pickCurrentCompSeasonId(null, null), null);
  assert.equal(pickCurrentCompSeasonId({}, null), null);
  assert.equal(pickCurrentCompSeasonId({ content: [] }, null), null);
  assert.equal(pickCurrentCompSeasonId({ content: [{ label: '2025/26' }] }, null), null);
});

test('findPulseliveMatchForFixture — matches via FPL team ids', () => {
  const pulseRows = [
    { fixtureId: 91234, homeId: 10, awayId: 1, homeAbbr: 'MCI', awayAbbr: 'ARS' },
  ];
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  const fx = { team_h: 11, team_a: 1 };
  const hit = findPulseliveMatchForFixture(fx, pulseToFpl, pulseRows);
  assert.equal(hit?.fixtureId, 91234);
});

test('findPulseliveMatchForFixture — prefers FPL `pulse_id` over team-pair heuristic', () => {
  // Same team pair plays twice in a season (home + away leg). Pulselive ships
  // both rows in the seasonal list; without `pulse_id` the old code returned
  // whichever leg came first (wrong scores for the OTHER GW). With FPL's
  // `pulse_id` ferried through, we always land on the right leg.
  const pulseRows = [
    {
      fixtureId: 91100,
      homeId: 1, // Arsenal home
      awayId: 10, // Man City away
      homeAbbr: 'ARS',
      awayAbbr: 'MCI',
      kickoffMs: Date.parse('2025-09-21T15:00:00Z'),
    },
    {
      fixtureId: 91234,
      homeId: 10, // Man City home (reverse leg)
      awayId: 1, // Arsenal away
      homeAbbr: 'MCI',
      awayAbbr: 'ARS',
      kickoffMs: Date.parse('2026-04-12T15:00:00Z'),
    },
  ];
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  // Direct pulse_id mapping → returns the exact match, regardless of order.
  const fx = {
    team_h: 11,
    team_a: 1,
    kickoff_time: '2026-04-12T15:00:00Z',
    pulse_id: 91234,
  };
  const hit = findPulseliveMatchForFixture(fx, pulseToFpl, pulseRows);
  assert.equal(hit?.fixtureId, 91234);
});

test('findPulseliveMatchForFixture — picks closest kickoff when pulse_id missing', () => {
  const pulseRows = [
    {
      fixtureId: 91100,
      homeId: 1,
      awayId: 10,
      homeAbbr: 'ARS',
      awayAbbr: 'MCI',
      kickoffMs: Date.parse('2025-09-21T15:00:00Z'),
    },
    {
      fixtureId: 91234,
      homeId: 10,
      awayId: 1,
      homeAbbr: 'MCI',
      awayAbbr: 'ARS',
      kickoffMs: Date.parse('2026-04-12T15:00:00Z'),
    },
  ];
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  // No `pulse_id` — disambiguate by `kickoff_time` proximity.
  const fx = { team_h: 11, team_a: 1, kickoff_time: '2026-04-12T15:00:00Z' };
  const hit = findPulseliveMatchForFixture(fx, pulseToFpl, pulseRows);
  assert.equal(hit?.fixtureId, 91234);
});

test('parsePulseliveLineups — happy path with full XI on both sides marks confirmed', () => {
  const fplFixture = { id: 1001, team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  const elevenStarters = (offset, teamId) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: offset + i,
      name: { display: `Player ${offset + i}` },
      matchShirtNumber: i + 1,
      matchPosition: i === 0 ? 'GK' : i < 5 ? 'D' : i < 8 ? 'M' : 'F',
      captain: i === 1,
      club: { id: teamId },
    }));
  const fixtureJson = {
    id: 91234,
    teamLists: [
      {
        teamId: 10,
        formation: { id: 1, label: '4-3-3' },
        lineup: elevenStarters(100, 10),
        substitutes: [
          { id: 200, name: { display: 'Sub A' }, matchShirtNumber: 12, matchPosition: 'G' },
        ],
      },
      {
        teamId: 1,
        formation: { id: 2, label: '4-2-3-1' },
        lineup: elevenStarters(300, 1),
        substitutes: [],
      },
    ],
  };
  const lu = parsePulseliveLineups(fixtureJson, fplFixture, pulseToFpl);
  assert.ok(lu);
  assert.equal(lu.home.confirmed, true);
  assert.equal(lu.away.confirmed, true);
  assert.equal(lu.home.formation, '4-3-3');
  assert.equal(lu.away.formation, '4-2-3-1');
  assert.equal(lu.home.xi.length, 11);
  assert.equal(lu.home.bench.length, 1);
  assert.equal(lu.home.xi[0].name, 'Player 100');
  assert.equal(lu.home.xi[0].shirt, 1);
  assert.equal(lu.home.xi[0].usualPosition, 'GK');
  assert.equal(lu.home.xi[1].captain, true);
  assert.equal(lu.home.teamId, 10);
});

test('parsePulseliveLineups — single-side XI stays unconfirmed', () => {
  const fplFixture = { id: 1001, team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  const eleven = (offset) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: offset + i,
      name: { display: `P${offset + i}` },
      matchShirtNumber: i + 1,
      matchPosition: 'M',
    }));
  const partialAway = [
    /** Only 5 players in away XI → away not "submitted" yet. */
    ...eleven(300).slice(0, 5),
  ];
  const fixtureJson = {
    teamLists: [
      { teamId: 10, formation: { label: '4-3-3' }, lineup: eleven(100), substitutes: [] },
      { teamId: 1, formation: { label: '4-3-3' }, lineup: partialAway, substitutes: [] },
    ],
  };
  const lu = parsePulseliveLineups(fixtureJson, fplFixture, pulseToFpl);
  assert.ok(lu);
  assert.equal(lu.home.confirmed, false);
  assert.equal(lu.away.confirmed, false);
});

test('parsePulseliveLineups — null on missing payload', () => {
  assert.equal(parsePulseliveLineups(null, { team_h: 1, team_a: 2 }, new Map()), null);
  assert.equal(parsePulseliveLineups({}, { team_h: 1, team_a: 2 }, new Map()), null);
  assert.equal(parsePulseliveLineups({ teamLists: [] }, { team_h: 1, team_a: 2 }, new Map()), null);
});

test('parsePulseliveLineups — name fallback to first/last when display missing', () => {
  const fplFixture = { id: 1001, team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([
    [10, 11],
    [1, 1],
  ]);
  const fixtureJson = {
    teamLists: [
      {
        teamId: 10,
        formation: { label: '4-3-3' },
        lineup: [
          { id: 999, name: { first: 'Erling', last: 'Haaland' }, matchShirtNumber: 9, matchPosition: 'F' },
        ],
        substitutes: [],
      },
      {
        teamId: 1,
        formation: { label: '4-3-3' },
        lineup: [
          { id: 998, name: { display: 'Bukayo Saka' }, matchShirtNumber: 7, matchPosition: 'F' },
        ],
        substitutes: [],
      },
    ],
  };
  const lu = parsePulseliveLineups(fixtureJson, fplFixture, pulseToFpl);
  assert.equal(lu.home.xi[0].name, 'Erling Haaland');
  assert.equal(lu.away.xi[0].name, 'Bukayo Saka');
});

/** Shared fixture for events tests — a small but full match with goal+assist, OG, cards. */
function eventsFixtureJson() {
  return {
    id: 91234,
    teamLists: [
      {
        teamId: 10,
        lineup: [
          { id: 4001, name: { display: 'Erling Haaland' } },
          { id: 4002, name: { display: 'Phil Foden' } },
          { id: 4003, name: { display: 'Kevin De Bruyne' } },
        ],
        substitutes: [{ id: 4099, name: { display: 'Late Sub' } }],
      },
      {
        teamId: 1,
        lineup: [
          { id: 5001, name: { display: 'Bukayo Saka' } },
          { id: 5002, name: { display: 'Martin Ødegaard' } },
        ],
        substitutes: [],
      },
    ],
    events: [
      /** Period markers — must be ignored. */
      { type: 'PS', clock: { secs: 0, label: "00'00" }, time: { millis: 1000 } },
      /** Goal with assistId — should emit a goal + an assist event. */
      {
        id: 700,
        type: 'G',
        description: 'G',
        personId: 4001,
        teamId: 10,
        assistId: 4003,
        clock: { secs: 1380, label: "23'00" },
        time: { millis: 2000 },
      },
      /** Yellow card. */
      {
        id: 701,
        type: 'B',
        description: 'Y',
        personId: 5001,
        teamId: 1,
        clock: { secs: 1800, label: "30'00" },
        time: { millis: 3000 },
      },
      /** Second-yellow red. */
      {
        id: 702,
        type: 'B',
        description: 'YR',
        personId: 5002,
        teamId: 1,
        clock: { secs: 3720, label: "62'00" },
        time: { millis: 4000 },
      },
      /** Own goal — kind=goal, isOwnGoal=true, NO assist sibling. */
      {
        id: 703,
        type: 'O',
        description: 'O',
        personId: 4002,
        teamId: 10,
        assistId: 4001,
        clock: { secs: 3000, label: "50'00" },
        time: { millis: 5000 },
      },
      /** Penalty annotation — should be dropped (the actual goal will arrive as a paired G:G). */
      {
        id: 704,
        type: 'P',
        description: 'P',
        personId: 5001,
        teamId: 1,
        clock: { secs: 4500, label: "75'00" },
        time: { millis: 6000 },
      },
      /** Substitution pair — should be dropped (we track subs via lineups). */
      {
        id: 705,
        type: 'S',
        description: 'ON',
        personId: 4099,
        teamId: 10,
        clock: { secs: 2700, label: "45'00" },
        time: { millis: 7000 },
      },
      {
        id: 705,
        type: 'S',
        description: 'OFF',
        personId: 4002,
        teamId: 10,
        clock: { secs: 2700, label: "45'00" },
        time: { millis: 7000 },
      },
    ],
  };
}

test('parsePulseliveEvents — goal emits both goal + assist with same eventId', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const evs = parsePulseliveEvents(eventsFixtureJson(), fplFixture, pulseToFpl);
  const goal = evs.find((e) => e.kind === 'goal' && !e.isOwnGoal && e.playerName === 'Erling Haaland');
  const assist = evs.find((e) => e.kind === 'assist' && e.playerName === 'Kevin De Bruyne');
  assert.ok(goal);
  assert.ok(assist);
  assert.equal(goal.eventId, 700);
  assert.equal(assist.eventId, 700);
  assert.equal(goal.teamSide, 'home');
  assert.equal(assist.teamSide, 'home');
  assert.equal(goal.minute, 23);
  assert.equal(goal.stoppage, 0);
});

test('parsePulseliveEvents — own goal kind=goal, isOwnGoal=true, NO assist emitted', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const evs = parsePulseliveEvents(eventsFixtureJson(), fplFixture, pulseToFpl);
  const og = evs.find((e) => e.playerName === 'Phil Foden');
  assert.ok(og);
  assert.equal(og.kind, 'goal');
  assert.equal(og.isOwnGoal, true);
  /** Pulselive carries an `assistId` on own-goal rows but we must NOT emit an assist for it. */
  const ogAssist = evs.find((e) => e.kind === 'assist' && e.eventId === 703);
  assert.equal(ogAssist, undefined);
});

test('parsePulseliveEvents — yellow + second-yellow red mapped correctly', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const evs = parsePulseliveEvents(eventsFixtureJson(), fplFixture, pulseToFpl);
  const y = evs.find((e) => e.kind === 'yellow');
  const r = evs.find((e) => e.kind === 'red');
  assert.ok(y);
  assert.ok(r);
  assert.equal(y.playerName, 'Bukayo Saka');
  assert.equal(y.teamSide, 'away');
  assert.equal(r.playerName, 'Martin Ødegaard');
  assert.equal(r.teamSide, 'away');
});

test('parsePulseliveEvents — drops PS/PE, P (penalty annotation), and S (subs)', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const evs = parsePulseliveEvents(eventsFixtureJson(), fplFixture, pulseToFpl);
  /** Expected output: goal + assist + yellow + red + own-goal = 5 entries. */
  assert.equal(evs.length, 5);
  for (const e of evs) {
    /** No period markers, no penalty markers, no subs should leak through. */
    assert.notEqual(e.kind, 'sub');
  }
});

test('parsePulseliveEvents — sorts chronologically by wallclock then minute', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const evs = parsePulseliveEvents(eventsFixtureJson(), fplFixture, pulseToFpl);
  /** Expected order: goal+assist (2s) → yellow (3s) → red (4s) → own goal (5s). */
  assert.deepEqual(
    evs.map((e) => `${e.kind}:${e.playerName}`),
    [
      'goal:Erling Haaland',
      'assist:Kevin De Bruyne',
      'yellow:Bukayo Saka',
      'red:Martin Ødegaard',
      'goal:Phil Foden',
    ],
  );
});

test('parsePulseliveEvents — drops events for unknown personId', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const fx = {
    teamLists: [
      { teamId: 10, lineup: [{ id: 4001, name: { display: 'Known' } }] },
      { teamId: 1, lineup: [] },
    ],
    events: [
      {
        id: 1,
        type: 'G',
        description: 'G',
        personId: 99999, /** not in any teamList */
        teamId: 10,
        clock: { secs: 600, label: "10'00" },
        time: { millis: 1000 },
      },
    ],
  };
  const evs = parsePulseliveEvents(fx, fplFixture, pulseToFpl);
  assert.deepEqual(evs, []);
});

test('parsePulseliveEvents — empty / malformed payloads', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  assert.deepEqual(parsePulseliveEvents(null, fplFixture, new Map()), []);
  assert.deepEqual(parsePulseliveEvents({}, fplFixture, new Map()), []);
  assert.deepEqual(parsePulseliveEvents({ events: [] }, fplFixture, new Map()), []);
});

test('parsePulseliveScore — live game with score', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const fx = {
    status: 'L',
    phase: '2',
    clock: { label: "67'00" },
    kickoff: { millis: 1779634800000 },
    teams: [
      { team: { id: 10 }, score: 2 },
      { team: { id: 1 }, score: 1 },
    ],
  };
  const s = parsePulseliveScore(fx, fplFixture, pulseToFpl);
  assert.equal(s.started, true);
  assert.equal(s.finished, false);
  assert.equal(s.statusText, 'Live');
  assert.equal(s.liveMinute, "67'00");
  assert.equal(s.homeScore, 2);
  assert.equal(s.awayScore, 1);
  assert.equal(s.kickoffIso, '2026-05-24T15:00:00.000Z');
});

test('parsePulseliveScore — finished game (status=C, phase=F)', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const fx = {
    status: 'C',
    phase: 'F',
    kickoff: { millis: 1779634800000 },
    teams: [
      { team: { id: 10 }, score: 3 },
      { team: { id: 1 }, score: 0 },
    ],
  };
  const s = parsePulseliveScore(fx, fplFixture, pulseToFpl);
  assert.equal(s.started, true);
  assert.equal(s.finished, true);
  assert.equal(s.statusText, 'FT');
  assert.equal(s.liveMinute, null);
  assert.equal(s.homeScore, 3);
  assert.equal(s.awayScore, 0);
});

test('parsePulseliveScore — upcoming game has no score', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const fx = {
    status: 'U',
    kickoff: { millis: 1779634800000 },
    teams: [
      { team: { id: 10 } },
      { team: { id: 1 } },
    ],
  };
  const s = parsePulseliveScore(fx, fplFixture, pulseToFpl);
  assert.equal(s.started, false);
  assert.equal(s.finished, false);
  assert.equal(s.statusText, 'Scheduled');
  assert.equal(s.homeScore, null);
  assert.equal(s.awayScore, null);
});

test('parsePulseliveScore — half-time', () => {
  const fplFixture = { team_h: 11, team_a: 1 };
  const pulseToFpl = new Map([[10, 11], [1, 1]]);
  const fx = {
    status: 'L',
    phase: 'H',
    teams: [
      { team: { id: 10 }, score: 1 },
      { team: { id: 1 }, score: 1 },
    ],
  };
  const s = parsePulseliveScore(fx, fplFixture, pulseToFpl);
  assert.equal(s.statusText, 'Half Time');
});

test('parsePulseliveScore — null on malformed payload', () => {
  assert.equal(parsePulseliveScore(null, { team_h: 1, team_a: 2 }, new Map()), null);
  assert.equal(parsePulseliveScore({}, { team_h: 1, team_a: 2 }, new Map()), null);
  assert.equal(
    parsePulseliveScore({ teams: [] }, { team_h: 1, team_a: 2 }, new Map()),
    null,
  );
});
