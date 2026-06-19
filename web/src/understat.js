/**
 * Understat parsing helpers (player per-90 rates + team-level aggregates).
 *
 * Understat exposes EPL data via `GET https://understat.com/main/getLeagueData/EPL/{startYear}`
 * which returns `{ teams, players, dates }`. Each team carries a per-match `history[]` with
 * xG/xGA/npxG/ppda/deep, etc. Season is the START year (e.g. 2025 → the 2025-26 season).
 *
 * These functions are pure (no network) so they're unit-testable; fetching lives in
 * scripts/fetch-understat.mjs.
 */

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Lowercase, strip accents, drop non-alphanumerics. */
export function normalisePlayerName(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Canonical team key that collapses Understat titles and FPL names/short-names onto the same
 * token, so the two sources can be joined despite naming differences.
 */
export function canonicalTeamKey(name) {
  const base = String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
  const aliases = {
    manchestercity: 'mancity',
    mancity: 'mancity',
    manchesterunited: 'manutd',
    manunited: 'manutd',
    manutd: 'manutd',
    newcastleunited: 'newcastle',
    newcastle: 'newcastle',
    wolverhamptonwanderers: 'wolves',
    wolverhampton: 'wolves',
    wolves: 'wolves',
    tottenhamhotspur: 'spurs',
    tottenham: 'spurs',
    spurs: 'spurs',
    nottinghamforest: 'nottmforest',
    nottmforest: 'nottmforest',
    nottinghamforestfc: 'nottmforest',
    westhamunited: 'westham',
    westham: 'westham',
    brightonhovealbion: 'brighton',
    brighton: 'brighton',
    leedsunited: 'leeds',
    leeds: 'leeds',
  };
  return aliases[base] ?? base;
}

/**
 * Resolve an Understat team title to an FPL team id.
 * @param {string} understatTitle
 * @param {{ id:number, name:string, short_name?:string }[]} fplTeams bootstrap `teams`
 * @returns {number | null}
 */
export function resolveFplTeamId(understatTitle, fplTeams = []) {
  const key = canonicalTeamKey(understatTitle);
  for (const t of fplTeams) {
    if (canonicalTeamKey(t.name) === key) return Number(t.id);
    if (t.short_name && canonicalTeamKey(t.short_name) === key) return Number(t.id);
  }
  return null;
}

/** One Understat player row → per-90 rates + raw season tallies. */
export function playerPer90FromUnderstat(p) {
  const minutes = num(p.time);
  const per90 = minutes > 0 ? 90 / minutes : 0;
  return {
    understatId: String(p.id),
    name: p.player_name,
    nameKey: normalisePlayerName(p.player_name),
    team: p.team_title,
    teamKey: canonicalTeamKey(p.team_title),
    position: p.position ?? null,
    games: num(p.games),
    minutes,
    goals: num(p.goals),
    assists: num(p.assists),
    npg: num(p.npg),
    xG90: num(p.xG) * per90,
    xA90: num(p.xA) * per90,
    npxG90: num(p.npxG) * per90,
    xGChain90: num(p.xGChain) * per90,
    xGBuildup90: num(p.xGBuildup) * per90,
    shots90: num(p.shots) * per90,
    keyPasses90: num(p.key_passes) * per90,
  };
}

/** @param {object} leagueData getLeagueData payload (or `{ players: [...] }`) */
export function parseUnderstatPlayers(leagueData) {
  const players = Array.isArray(leagueData?.players) ? leagueData.players : [];
  return players.map(playerPer90FromUnderstat);
}

function ppdaValue(p) {
  // Understat ppda = passes by attacking team / defensive actions. Lower = more intense press.
  const att = num(p?.att);
  const def = num(p?.def);
  return def > 0 ? att / def : 0;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/** Aggregate one team's per-match `history[]` into per-match means + home/away splits. */
export function aggregateTeamHistory(history = []) {
  const all = history;
  const home = history.filter((m) => m.h_a === 'h');
  const away = history.filter((m) => m.h_a === 'a');
  const side = (rows) => ({
    matches: rows.length,
    xGFor: mean(rows.map((m) => num(m.xG))),
    xGAgainst: mean(rows.map((m) => num(m.xGA))),
    npxGFor: mean(rows.map((m) => num(m.npxG))),
    npxGAgainst: mean(rows.map((m) => num(m.npxGA))),
    goalsFor: mean(rows.map((m) => num(m.scored))),
    goalsAgainst: mean(rows.map((m) => num(m.missed))),
    cleanSheetRate: rows.length ? rows.filter((m) => num(m.missed) === 0).length / rows.length : 0,
    ppda: mean(rows.map((m) => ppdaValue(m.ppda))),
    ppdaAllowed: mean(rows.map((m) => ppdaValue(m.ppda_allowed))),
    deep: mean(rows.map((m) => num(m.deep))),
    deepAllowed: mean(rows.map((m) => num(m.deep_allowed))),
  });
  return { ...side(all), home: side(home), away: side(away) };
}

/**
 * @param {object} leagueData getLeagueData payload
 * @returns {{ [understatTitle: string]: ReturnType<typeof aggregateTeamHistory> & { title: string, understatId: string } }}
 */
export function parseUnderstatTeams(leagueData) {
  const teams = leagueData?.teams ?? {};
  const out = {};
  for (const t of Object.values(teams)) {
    if (!t?.title) continue;
    out[t.title] = {
      understatId: String(t.id),
      title: t.title,
      ...aggregateTeamHistory(Array.isArray(t.history) ? t.history : []),
    };
  }
  return out;
}
