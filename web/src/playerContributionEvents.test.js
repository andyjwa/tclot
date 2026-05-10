import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLatestDropByElementOut,
  buildOwnerByElementId,
  buildTrackedElementIdSet,
  buildTrackedElementIdSetWithFixtures,
  compareContributionEventsAsc,
  compareContributionEventsDesc,
  contributionApproxTimelineSortKey,
  compareContributionEventsAscWithContext,
  contributionCoverageKey,
  contributionCoveredByTimelineOmit,
  contributionEventMatchesGameweek,
  fplTotalFeedEventContradictsLive,
  liveElementRowForFeedValidation,
  effectiveContributionSortKey,
  diffContributionEvents,
  elementIdsFromGwFixtureTeams,
  englishOrdinal,
  fplCumulativeEventOrdinalLabel,
  primaryFixtureForContribution,
  saveFantasyPointsFromSaves,
} from './playerContributionEvents.js';

test('englishOrdinal — basic ordinals', () => {
  assert.equal(englishOrdinal(1), '1st');
  assert.equal(englishOrdinal(2), '2nd');
  assert.equal(englishOrdinal(3), '3rd');
  assert.equal(englishOrdinal(4), '4th');
  assert.equal(englishOrdinal(11), '11th');
  assert.equal(englishOrdinal(12), '12th');
  assert.equal(englishOrdinal(13), '13th');
  assert.equal(englishOrdinal(22), '22nd');
});

test('fplCumulativeEventOrdinalLabel — tot2+ goal/assist only', () => {
  assert.equal(fplCumulativeEventOrdinalLabel('34:5:assist:tot1', 'assist'), null);
  assert.equal(
    fplCumulativeEventOrdinalLabel('34:5:assist:tot2', 'assist'),
    '2nd assist'
  );
  assert.equal(
    fplCumulativeEventOrdinalLabel('34:5:goal:tot3', 'goal'),
    '3rd goal'
  );
  assert.equal(
    fplCumulativeEventOrdinalLabel('espn:1:2:3:4', 'assist'),
    null
  );
  assert.equal(fplCumulativeEventOrdinalLabel('34:5:yellow_card:tot2', 'yellow_card'), null);
});

test('contributionEventMatchesGameweek — FPL stableId and field', () => {
  assert.equal(
    contributionEventMatchesGameweek(
      { gameweek: 34, stableId: '34:1:goal:tot1' },
      34
    ),
    true
  );
  assert.equal(
    contributionEventMatchesGameweek(
      { gameweek: 33, stableId: '33:1:goal:tot1' },
      34
    ),
    false
  );
  assert.equal(
    contributionEventMatchesGameweek({ stableId: '33:1:goal:tot1' }, 34),
    false
  );
  assert.equal(
    contributionEventMatchesGameweek(
      { gameweek: 34, stableId: 'espn:1:2:3:1' },
      34
    ),
    true
  );
  assert.equal(
    contributionEventMatchesGameweek({ stableId: 'espn:1:2' }, 34),
    false
  );
});

test('saveFantasyPointsFromSaves — only GKP, 1 pt per 3 saves', () => {
  assert.equal(saveFantasyPointsFromSaves(0, 1), 0);
  assert.equal(saveFantasyPointsFromSaves(2, 1), 0);
  assert.equal(saveFantasyPointsFromSaves(3, 1), 1);
  assert.equal(saveFantasyPointsFromSaves(6, 1), 2);
  assert.equal(saveFantasyPointsFromSaves(9, 2), 0);
});

test('elementIdsFromGwFixtureTeams picks players on teams in GW', () => {
  const elementById = {
    1: { id: 1, team: 10 },
    2: { id: 2, team: 99 },
  };
  const s = elementIdsFromGwFixtureTeams(elementById, [10]);
  assert.deepEqual([...s], [1]);
});

test('buildTrackedElementIdSetWithFixtures includes fixture-team players', () => {
  const squads = [
    {
      leagueEntryId: 1,
      teamName: 'A',
      starters: [{ element: 5 }],
      bench: [],
    },
  ];
  const elementById = {
    5: { id: 5, team: 1 },
    9: { id: 9, team: 2 },
  };
  const s = buildTrackedElementIdSetWithFixtures(squads, [], elementById, [2]);
  assert.ok(s.has(5));
  assert.ok(s.has(9));
});

test('buildTrackedElementIdSet unions squads and waiver drops', () => {
  const squads = [
    {
      leagueEntryId: 1,
      teamName: 'A',
      starters: [{ element: 10 }],
      bench: [{ element: 20 }],
    },
  ];
  const waivers = [{ element_out: 99, entry: 1, gameweek: 5, transactionId: 1 }];
  const s = buildTrackedElementIdSet(squads, waivers);
  assert.deepEqual([...s].sort((a, b) => a - b), [10, 20, 99]);
});

test('buildOwnerByElementId — first squad wins on duplicate', () => {
  const squads = [
    {
      leagueEntryId: 1,
      teamName: 'First',
      starters: [{ element: 5 }],
      bench: [],
    },
    {
      leagueEntryId: 2,
      teamName: 'Second',
      starters: [{ element: 5 }],
      bench: [],
    },
  ];
  const m = buildOwnerByElementId(squads);
  assert.equal(m.get(5).teamName, 'First');
});

test('buildLatestDropByElementOut — highest GW wins', () => {
  const rows = [
    {
      element_out: 7,
      entry: 1,
      gameweek: 10,
      transactionId: 100,
      teamName: 'Old',
    },
    {
      element_out: 7,
      entry: 2,
      gameweek: 12,
      transactionId: 50,
      teamName: 'NewerGW',
    },
  ];
  const m = buildLatestDropByElementOut(rows);
  assert.equal(m.get(7).gameweek, 12);
  assert.equal(m.get(7).teamName, 'NewerGW');
  assert.equal(m.get(7).leagueEntryId, 2);
});

test('diffContributionEvents — bootstrap with 0′ minutes: no spurious goal/assist/dc/save rows', () => {
  const next = {
    1: {
      stats: {
        goals_scored: 0,
        assists: 0,
        saves: 3,
        minutes: 0,
      },
      explain: [],
    },
    2: {
      stats: { goals_scored: 0, assists: 1, minutes: 0, defensive_contribution: 1 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: null,
    nextLiveByElementId: next,
    elementById: {
      1: { element_type: 1 },
      2: { element_type: 2 },
    },
    trackedElementIds: new Set([1, 2]),
    gameweek: 5,
    nowIso: '2026-01-01T12:00:00.000Z',
  });
  assert.equal(
    out.length,
    0,
    'bootstrap should not treat pre-clock placeholder totals as events'
  );
});

test('diffContributionEvents — 0-min totals do not emit after bootstrap either', () => {
  const prev = {
    1: { stats: { goals_scored: 0, assists: 0, minutes: 0, saves: 0 }, explain: [] },
  };
  const next = {
    1: {
      stats: { goals_scored: 1, assists: 1, minutes: 0, saves: 0 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 1: { element_type: 3 } },
    trackedElementIds: new Set([1]),
    gameweek: 5,
    nowIso: '2026-01-01T12:00:00.000Z',
  });
  assert.equal(out.length, 0, 'FPL 0-min rows must not become feed events on any tick');
});

test('contributionCoveredByTimelineOmit — SGW aliases goal/assist when fixture id mismatches :na or wrong id', () => {
  const cov = new Set([contributionCoverageKey(7, 'assist', 42)]);
  const gw = [{ id: 42, team_h: 3, team_a: 4 }];
  assert.equal(
    contributionCoveredByTimelineOmit(cov, 7, 'assist', 999, 3, gw),
    true
  );
  assert.equal(
    contributionCoveredByTimelineOmit(cov, 7, 'yellow_card', 999, 3, gw),
    false
  );
  const dgw = [
    { id: 40, team_h: 3, team_a: 4 },
    { id: 41, team_h: 3, team_a: 5 },
  ];
  assert.equal(
    contributionCoveredByTimelineOmit(cov, 7, 'assist', 999, 3, dgw),
    false
  );
});

test('contributionCoveredByTimelineOmit — :na FPL; SGW mismatch with team+fixtures (no :na on teamId)', () => {
  const cov = new Set([contributionCoverageKey(7, 'assist', 100)]);
  assert.equal(
    contributionCoveredByTimelineOmit(cov, 7, 'assist', null, Number.NaN, []),
    true
  );
  // Single fixture for team 3, ESPN 100, FPL row says 999 → still duplicate
  assert.equal(
    contributionCoveredByTimelineOmit(cov, 7, 'assist', 999, 3, [
      { id: 100, team_h: 3, team_a: 2 },
    ]),
    true
  );
});

test('primaryFixtureForContribution — DGW: single active explain block wins over earlier kickoff', () => {
  const gw = [
    { id: 10, team_h: 3, team_a: 4, kickoff_time: '2026-01-10T12:00:00Z' },
    { id: 11, team_h: 3, team_a: 5, kickoff_time: '2026-01-11T12:00:00Z' },
  ];
  const row = {
    stats: { minutes: 90, assists: 1 },
    explain: [[[{ stat: 'minutes', value: 90 }], 11]],
  };
  const fx = primaryFixtureForContribution(row, 3, gw);
  assert.equal(fx?.id, 11);
});

test('fplTotalFeedEventContradictsLive — stale assist row vs 0 state', () => {
  const ev = { kind: 'assist', stableId: '34:1:assist:tot1' };
  const live0 = { stats: { goals_scored: 0, assists: 0, minutes: 0 }, explain: [] };
  assert.equal(fplTotalFeedEventContradictsLive(ev, live0, 2), true);
  const liveOk = { stats: { goals_scored: 0, assists: 1, minutes: 1 }, explain: [] };
  assert.equal(fplTotalFeedEventContradictsLive(ev, liveOk, 2), false);
  const liveGhostWithMins = {
    stats: { goals_scored: 0, assists: 0, minutes: 90 },
    explain: [],
  };
  assert.equal(
    fplTotalFeedEventContradictsLive(ev, liveGhostWithMins, 2),
    true,
    '0 assists but 90min on pitch: previously skipped; still a ghost'
  );
});

test('fplTotalFeedEventContradictsLive — save_points tot vs live FPL save pts (GKP)', () => {
  const ev = { kind: 'save_points', stableId: '34:1:save_points:tot1' };
  const liveNoSaves = {
    stats: { goals_scored: 0, assists: 0, saves: 2, minutes: 90 },
    explain: [],
  };
  assert.equal(fplTotalFeedEventContradictsLive(ev, liveNoSaves, 1), true);
  const liveOnePt = {
    stats: { goals_scored: 0, assists: 0, saves: 3, minutes: 90 },
    explain: [],
  };
  assert.equal(fplTotalFeedEventContradictsLive(ev, liveOnePt, 1), false);
});

test('liveElementRowForFeedValidation — full row wins; else stats map', () => {
  const full = { 7: { stats: { assists: 1, minutes: 1 }, explain: [] } };
  const stats = { 7: { assists: 0, minutes: 0 } };
  const row7 = liveElementRowForFeedValidation(full, null, 7);
  assert.equal((row7?.stats || {}).assists, 1);
  assert.equal(
    liveElementRowForFeedValidation(null, { 8: { assists: 0, minutes: 0 } }, 8)?.stats
      ?.assists,
    0
  );
  const stats2 = { ...stats, 9: { assists: 0, minutes: 0 } };
  assert.equal(
    liveElementRowForFeedValidation({ 9: null }, stats2, 9)?.stats?.assists,
    0
  );
  assert.equal(
    liveElementRowForFeedValidation({ 9: undefined }, stats2, 9)?.stats?.assists,
    0
  );
  const ev = { kind: 'assist', stableId: '34:9:assist:tot1' };
  const merged = liveElementRowForFeedValidation(
    { 9: undefined },
    { 9: { assists: 0, minutes: 0 } },
    9
  );
  assert.equal(fplTotalFeedEventContradictsLive(ev, merged, 2), true);
});

test('diffContributionEvents — bootstrap (no prev): goals/assists/saves/dc vs zero; cards need delta tick', () => {
  const next = {
    12: {
      stats: {
        goals_scored: 2,
        assists: 1,
        saves: 0,
        yellow_cards: 1,
        red_cards: 0,
        minutes: 90,
      },
      explain: [],
    },
    99: {
      stats: { goals_scored: 0, assists: 0, saves: 6, minutes: 90 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: null,
    nextLiveByElementId: next,
    elementById: {
      12: { element_type: 3 },
      99: { element_type: 1 },
    },
    trackedElementIds: new Set([12, 99]),
    gameweek: 5,
    nowIso: '2026-01-01T12:00:00.000Z',
  });
  const kinds = new Set(out.map((e) => e.kind));
  assert.ok(kinds.has('goal'));
  assert.ok(kinds.has('assist'));
  assert.ok(!kinds.has('yellow_card'));
  assert.ok(kinds.has('save_points'));
  const saveEv = out.find((e) => e.kind === 'save_points');
  assert.equal(saveEv?.elementId, 99);
  assert.equal(saveEv?.delta, 2);
});

test('diffContributionEvents — yellow and red card deltas', () => {
  const prev = {
    5: {
      stats: { yellow_cards: 0, red_cards: 0, minutes: 90 },
      explain: [],
    },
  };
  const next = {
    5: {
      stats: { yellow_cards: 1, red_cards: 1, minutes: 90 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 5: { element_type: 3 } },
    trackedElementIds: new Set([5]),
    gameweek: 3,
    nowIso: '2026-01-01T12:00:00.000Z',
  });
  const kinds = new Set(out.map((e) => e.kind));
  assert.ok(kinds.has('yellow_card'));
  assert.ok(kinds.has('red_card'));
});

test('contributionApproxTimelineSortKey — explain fixture minutes trump blind stats.minutes', () => {
  const gwFixtures = [
    {
      id: 100,
      team_h: 1,
      team_a: 2,
      kickoff_time: '2026-04-12T14:00:00Z',
    },
  ];
  const el = { id: 5, team: 1 };
  const withExplain = {
    stats: { goals_scored: 1, minutes: 90 },
    explain: [[[{ stat: 'minutes', value: 34 }], 100]],
  };
  const statsOnly = {
    stats: { goals_scored: 1, minutes: 90 },
    explain: [],
  };
  const kExpl = contributionApproxTimelineSortKey(withExplain, el, 'goal', gwFixtures, 5);
  const kAgg = contributionApproxTimelineSortKey(statsOnly, el, 'goal', gwFixtures, 5);
  assert.ok(
    kExpl < kAgg,
    'per-fixture explain minutes align with clock; aggregate 90 would mis-order vs real 34′'
  );
});

test('contributionApproxTimelineSortKey — later emit sequence nudges key (same-minute ties)', () => {
  const gwFixtures = [
    {
      id: 100,
      team_h: 1,
      team_a: 2,
      kickoff_time: '2026-04-12T14:00:00Z',
    },
  ];
  const el = { id: 5, team: 1 };
  const row = {
    stats: { goals_scored: 1, minutes: 60 },
    explain: [],
  };
  const k0 = contributionApproxTimelineSortKey(row, el, 'goal', gwFixtures, 5, 0);
  const k1 = contributionApproxTimelineSortKey(row, el, 'goal', gwFixtures, 5, 1);
  assert.equal(k1 - k0, 4, 'emit sequence nudge stays within one match minute');
});

test('contributionApproxTimelineSortKey — later kickoff sorts higher', () => {
  const gwFixtures = [
    {
      id: 100,
      team_h: 1,
      team_a: 2,
      kickoff_time: '2026-04-12T14:00:00Z',
      minutes: 45,
    },
    {
      id: 101,
      team_h: 3,
      team_a: 4,
      kickoff_time: '2026-04-12T17:30:00Z',
      minutes: 20,
    },
  ];
  const elEarly = { team: 1 };
  const elLate = { team: 3 };
  const rowEarly = {
    stats: { goals_scored: 1, minutes: 45 },
    explain: [[[{ stat: 'minutes', value: 45 }], 100]],
  };
  const rowLate = {
    stats: { goals_scored: 1, minutes: 20 },
    explain: [[[{ stat: 'minutes', value: 20 }], 101]],
  };
  const kEarly = contributionApproxTimelineSortKey(rowEarly, elEarly, 'goal', gwFixtures);
  const kLate = contributionApproxTimelineSortKey(rowLate, elLate, 'goal', gwFixtures);
  assert.ok(kLate > kEarly, 'later TV window should sort after earlier kickoff + clock');
});

test('compareContributionEventsAsc — earlier sortKey sorts first (match order)', () => {
  const a = { sortKey: 100, recordedAt: '2026-01-02T00:00:00.000Z', stableId: 'a' };
  const b = { sortKey: 200, recordedAt: '2026-01-01T00:00:00.000Z', stableId: 'b' };
  assert.ok(compareContributionEventsAsc(a, b) < 0, 'earlier timeline key (a) before later (b)');
});

test('effectiveContributionSortKey — FPL recomputes when sortKey is bogus; preserves sane frozen keys', () => {
  const gwFixtures = [
    {
      id: 100,
      team_h: 1,
      team_a: 2,
      kickoff_time: '2026-04-12T14:00:00Z',
    },
  ];
  const elementById = {
    5: { id: 5, team: 1 },
  };
  const liveFullByElementId = {
    5: {
      stats: { goals_scored: 1, minutes: 90 },
      explain: [[[{ stat: 'minutes', value: 45 }], 100]],
    },
  };
  const sortCtx = { liveFullByElementId, elementById, gwFixtures };
  const fplEv = {
    stableId: '8:5:goal:tot1',
    kind: 'goal',
    elementId: 5,
    sortKey: 1,
  };
  const kFpl = effectiveContributionSortKey(fplEv, sortCtx);
  assert.ok(kFpl > 1e12, 'recomputed from kickoff + explain minute');
  const el = elementById[5];
  const rowAt47 = {
    stats: { assists: 1, minutes: 47 },
    explain: [[[{ stat: 'minutes', value: 47 }], 100]],
  };
  const frozenAssistKey = contributionApproxTimelineSortKey(
    rowAt47,
    el,
    'assist',
    gwFixtures,
    5,
    0
  );
  const assistEv = {
    stableId: '8:5:assist:tot1',
    kind: 'assist',
    elementId: 5,
    sortKey: frozenAssistKey,
  };
  const liveFullFt = {
    5: {
      stats: { assists: 1, minutes: 90 },
      explain: [[[{ stat: 'minutes', value: 90 }], 100]],
    },
  };
  assert.equal(
    effectiveContributionSortKey(assistEv, {
      ...sortCtx,
      liveFullByElementId: liveFullFt,
    }),
    frozenAssistKey,
    'FT live row must not drag 47′ assist to top of feed',
  );
  const fm = {
    stableId: 'fotmob:9:yellow_card:5:x:1',
    kind: 'yellow_card',
    elementId: 5,
    sortKey: 1.717e12,
  };
  assert.equal(effectiveContributionSortKey(fm, sortCtx), 1.717e12);
  const es = {
    stableId: 'espn:740928:x:goal:1:5',
    kind: 'goal',
    elementId: 5,
    sortKey: 1.8e12,
  };
  assert.equal(effectiveContributionSortKey(es, sortCtx), 1.8e12);
});

test('compareContributionEventsAscWithContext — earlier effective key sorts first (chronological top)', () => {
  const sortCtx = {
    liveFullByElementId: {},
    elementById: {},
    gwFixtures: [],
  };
  const cmp = compareContributionEventsAscWithContext(sortCtx);
  const early = { sortKey: 100, recordedAt: '2026-01-01T12:00:00.000Z', stableId: 'a' };
  const late = { sortKey: 200, recordedAt: '2026-01-01T12:00:00.000Z', stableId: 'b' };
  assert.ok(cmp(early, late) < 0, 'lower key first');
});

test('compareContributionEventsDesc — later sortKey sorts first (newest at top of feed)', () => {
  const a = { sortKey: 100, recordedAt: '2026-01-02T00:00:00.000Z', stableId: 'a' };
  const b = { sortKey: 200, recordedAt: '2026-01-01T00:00:00.000Z', stableId: 'b' };
  assert.ok(compareContributionEventsDesc(b, a) < 0, 'later timeline key (b) before earlier (a) in feed');
});

test('diffContributionEvents — omitByElementKind skips covered (element, kind, fixture) only', () => {
  const prev = {
    12: {
      stats: { goals_scored: 0, assists: 0, saves: 0, minutes: 45 },
      explain: [],
    },
    15: {
      stats: { goals_scored: 0, assists: 0, saves: 0, minutes: 45 },
      explain: [],
    },
  };
  const next = {
    12: {
      stats: { goals_scored: 1, assists: 0, saves: 0, minutes: 90 },
      explain: [],
    },
    15: {
      stats: { goals_scored: 1, assists: 1, saves: 0, minutes: 90 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 12: { element_type: 3 }, 15: { element_type: 3 } },
    trackedElementIds: new Set([12, 15]),
    gameweek: 8,
    nowIso: '2026-01-01T12:00:00.000Z',
    omitByElementKind: new Set([contributionCoverageKey(12, 'goal', null)]),
  });
  const byKey = out.map((e) => `${e.elementId}:${e.kind}`).sort();
  assert.deepEqual(byKey, ['15:assist', '15:goal']);
});

test('diffContributionEvents — FPL assist still emits if ESPN only covered a different fixture', () => {
  const gwFixtures = [
    { id: 100, team_h: 5, team_a: 6, kickoff_time: '2026-04-10T12:00:00Z' },
  ];
  const prev = {
    20: {
      stats: { goals_scored: 0, assists: 0, saves: 0, minutes: 0 },
      explain: [[[{ stat: 'minutes', value: 90 }], 100]],
    },
  };
  const next = {
    20: {
      stats: { goals_scored: 0, assists: 1, saves: 0, minutes: 90 },
      explain: [[[{ stat: 'minutes', value: 90 }], 100]],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 20: { element_type: 2, team: 5 } },
    trackedElementIds: new Set([20]),
    gameweek: 8,
    nowIso: '2026-01-01T12:00:00.000Z',
    gwFixtures,
    omitByElementKind: new Set([contributionCoverageKey(20, 'assist', 999)]),
  });
  const assistEv = out.find((e) => e.kind === 'assist');
  assert.ok(assistEv, 'omit key was wrong fixture; assist in fixture 100 should still emit');
  assert.equal(assistEv.fplFixtureId, 100);
});

test('diffContributionEvents — omitKinds skips goal', () => {
  const prev = {
    12: {
      stats: { goals_scored: 0, assists: 0, saves: 0, minutes: 45 },
      explain: [],
    },
  };
  const next = {
    12: {
      stats: { goals_scored: 1, assists: 0, saves: 0, minutes: 90 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 12: { element_type: 3 } },
    trackedElementIds: new Set([12]),
    gameweek: 8,
    nowIso: '2026-01-01T12:00:00.000Z',
    omitKinds: new Set(['goal']),
  });
  assert.equal(out.length, 0);
});

test('diffContributionEvents — goals and assists deltas', () => {
  const prev = {
    12: {
      stats: { goals_scored: 0, assists: 1, saves: 0, minutes: 45 },
      explain: [],
    },
  };
  const next = {
    12: {
      stats: { goals_scored: 1, assists: 3, saves: 0, minutes: 90 },
      explain: [],
    },
  };
  const out = diffContributionEvents({
    prevLiveByElementId: prev,
    nextLiveByElementId: next,
    elementById: { 12: { element_type: 3 } },
    trackedElementIds: new Set([12]),
    gameweek: 8,
    nowIso: '2026-01-01T12:00:00.000Z',
  });
  const kinds = new Set(out.map((e) => e.kind));
  assert.ok(kinds.has('goal'));
  assert.ok(kinds.has('assist'));
  const goalEv = out.find((e) => e.kind === 'goal');
  assert.equal(goalEv.delta, 1);
  const asEv = out.find((e) => e.kind === 'assist');
  assert.equal(asEv.delta, 2);
});
