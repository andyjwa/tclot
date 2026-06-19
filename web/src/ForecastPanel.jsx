import { useMemo, useState } from 'react';
import { usePredictions } from './usePredictions.js';
import { useConfirmedLineups } from './useConfirmedLineups.js';
import {
  POSITIONS,
  filterAndSortPlayers,
  teamsInPredictions,
  breakdownSegments,
  predictionsById,
  matchupLean,
  teamForecastDistribution,
  h2hWinProbs,
  tierFor,
  rangeFor,
  outcomeOdds,
  outcomeBar,
  isTwoWorld,
  twoWorldView,
  applyConfirmedRolesToPlayers,
} from './forecastHelpers.js';

const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
const SEG_CLASS = {
  minutes: 'forecast-seg--mins',
  goals: 'forecast-seg--goals',
  assists: 'forecast-seg--assists',
  cleanSheet: 'forecast-seg--cs',
  saves: 'forecast-seg--saves',
  defensiveContribution: 'forecast-seg--dc',
  bonus: 'forecast-seg--bonus',
};
// Fixed range-bar domain so floors/ceilings are comparable across the leaderboard.
const RANGE_DOMAIN = 16;
const ROLE_BADGE = {
  xi: { label: 'XI', cls: 'forecast-role--xi', title: 'Confirmed in the starting XI' },
  bench: { label: 'Bench', cls: 'forecast-role--bench', title: 'Named substitute' },
  absent: { label: 'Out', cls: 'forecast-role--absent', title: 'Not in the matchday squad' },
};

function fmt1(n) {
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : '—';
}
function pct(n) {
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';
}

function relativeTime(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function HealthStrip({ predictions, health, lineupsActive, confirmedCount }) {
  const gw = predictions?.gameweek ?? health?.gameweek ?? null;
  const updated = relativeTime(predictions?.generatedAt || health?.updatedAt);
  const enrichment = predictions?.source?.enrichment;
  const us = predictions?.understat;
  const idm = health?.idMismatches || predictions?.idMismatches;
  const chips = [];
  if (gw != null) chips.push({ label: 'Gameweek', value: `GW ${gw}` });
  if (updated) chips.push({ label: 'Updated', value: updated });
  if (enrichment) chips.push({ label: 'Model', value: enrichment === 'fpl+understat' ? 'FPL + Understat' : enrichment });
  if (us?.available) {
    chips.push({ label: 'Understat', value: `${Math.round((us.playerMatchRate ?? 0) * 100)}% players · ${us.teamsEnriched ?? 0}/20 teams` });
  }
  if (idm) {
    const unresolved = idm.unresolved ?? 0;
    chips.push({
      label: 'ID reconciliation',
      value: unresolved > 0 ? `${unresolved} unresolved` : 'clean',
      warn: unresolved > 0,
    });
  }
  if (lineupsActive) {
    chips.push({
      label: 'Lineups',
      value: confirmedCount > 0 ? `${confirmedCount} confirmed` : 'watching',
      live: true,
    });
  }
  if (!chips.length) return null;
  return (
    <div className="forecast-health" role="status">
      {chips.map((c) => (
        <span
          key={c.label}
          className={
            'forecast-health__chip' +
            (c.warn ? ' forecast-health__chip--warn' : '') +
            (c.live ? ' forecast-health__chip--live' : '')
          }
        >
          <span className="forecast-health__label">{c.label}</span>
          <span className="forecast-health__value tabular">{c.value}</span>
        </span>
      ))}
    </div>
  );
}

function TierBadge({ tier }) {
  return (
    <span className={'forecast-tier forecast-tier--' + tier.key} title={`Tier: ${tier.label}`}>
      {tier.label}
    </span>
  );
}

/** Mutually-exclusive blank / decent / haul bar for outfield (MID/FWD) players. */
function OutcomeCell({ forecast }) {
  const bands = outcomeBar(forecast);
  const odds = outcomeOdds(forecast);
  return (
    <div className="forecast-outlook">
      <div className="forecast-outlook__bar" role="img" aria-label={`Haul ${odds.haul ?? 0}%, return ${odds.returns ?? 0}%, blank ${odds.blank ?? 0}%`}>
        {bands.map((b) => (
          <span
            key={b.key}
            className={'forecast-band forecast-band--' + b.key}
            style={{ width: `${b.pct}%` }}
            title={`${b.label} ${b.pct}%`}
          />
        ))}
      </div>
      <div className="forecast-outlook__legend">
        <span className="forecast-outlook__haul">Haul {odds.haul ?? 0}%</span>
        <span className="forecast-outlook__sep" aria-hidden="true">·</span>
        <span>Return {odds.returns ?? 0}%</span>
        <span className="forecast-outlook__sep" aria-hidden="true">·</span>
        <span className="muted">Blank {odds.blank ?? 0}%</span>
      </div>
    </div>
  );
}

/** Clean-sheet "two-world" view for GK/DEF. */
function TwoWorldCell({ player }) {
  const w = twoWorldView(player);
  if (!w) return <span className="muted">—</span>;
  const csInt = Math.round(w.csProb * 100);
  const noCsInt = 100 - csInt;
  return (
    <div className="forecast-twoworld">
      <div className="forecast-twoworld__bar" role="img" aria-label={`Clean sheet ${csInt}% chance`}>
        <span className="forecast-twoworld__nocs" style={{ width: `${noCsInt}%` }} />
        <span className="forecast-twoworld__cs" style={{ width: `${csInt}%` }} />
      </div>
      <div className="forecast-twoworld__legend">
        <span>No CS {noCsInt}% → <b className="tabular">{fmt1(w.noCsPoints)}</b></span>
        <span className="forecast-twoworld__sep" aria-hidden="true">·</span>
        <span className="forecast-twoworld__win">CS {csInt}% → <b className="tabular">{fmt1(w.csPoints)}</b></span>
      </div>
    </div>
  );
}

function RangeBar({ forecast }) {
  const r = rangeFor(forecast);
  if (r.low == null || r.high == null) return <span className="muted">—</span>;
  const scale = (v) => `${Math.min(100, Math.max(0, (v / RANGE_DOMAIN) * 100))}%`;
  const lowPct = Math.min(100, Math.max(0, (r.low / RANGE_DOMAIN) * 100));
  const highPct = Math.min(100, Math.max(0, (r.high / RANGE_DOMAIN) * 100));
  return (
    <div className="forecast-range">
      <div className="forecast-range__track" aria-hidden="true">
        <span
          className="forecast-range__fill"
          style={{ left: `${lowPct}%`, width: `${Math.max(3, highPct - lowPct)}%` }}
        />
        {r.mid != null ? <span className="forecast-range__median" style={{ left: scale(r.mid) }} /> : null}
      </div>
      <span className="tabular forecast-range__text">
        {r.low}–{r.high}
      </span>
    </div>
  );
}

function ForecastRow({ player, expanded, onToggle }) {
  const f = player.forecast || {};
  const prob = f.probabilities || {};
  const pc = f.percentiles || {};
  const tier = tierFor(f);
  const role = player.confirmedRole || null;
  const roleBadge = role ? ROLE_BADGE[role] : null;
  const absent = role === 'absent';
  const delta = Number.isFinite(player.xpDelta) ? player.xpDelta : null;
  const doubt =
    !role && player.status && player.status !== 'a'
      ? player.chanceOfPlaying != null
        ? `${player.chanceOfPlaying}%`
        : '!'
      : null;

  return (
    <>
      <tr
        className={
          'forecast-row' +
          (expanded ? ' forecast-row--open' : '') +
          (absent ? ' forecast-row--absent' : '')
        }
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <td className="forecast-row__name">
          <button type="button" className="forecast-row__toggle" aria-label={expanded ? 'Collapse' : 'Expand'}>
            <span className={'forecast-row__chevron' + (expanded ? ' forecast-row__chevron--open' : '')}>▸</span>
          </button>
          <span className="forecast-row__player">
            <span className="forecast-row__web">
              {player.name}
              {roleBadge ? (
                <span className={'forecast-role ' + roleBadge.cls} title={roleBadge.title}>
                  {roleBadge.label}
                </span>
              ) : null}
            </span>
            <span className="forecast-row__team muted">
              {player.teamShortName || player.team}
              {doubt ? <span className="forecast-row__doubt" title="Injury / availability doubt"> · {doubt}</span> : null}
              {player.understat?.matched ? <span className="forecast-row__us" title="Understat xG/xA blended"> · xG</span> : null}
            </span>
          </span>
        </td>
        <td className="col-pos tabular muted">{POS_LABEL[player.position] || player.position}</td>
        <td className="forecast-row__tier">{absent ? <span className="muted">—</span> : <TierBadge tier={tier} />}</td>
        <td className="forecast-row__outlook">
          {absent ? (
            <span className="forecast-row__notstarting">Not starting</span>
          ) : isTwoWorld(player.position) ? (
            <TwoWorldCell player={player} />
          ) : (
            <OutcomeCell forecast={f} />
          )}
        </td>
        <td className="forecast-row__rangecell">{absent ? <span className="muted">—</span> : <RangeBar forecast={f} />}</td>
        <td className="tabular forecast-row__xp">
          {fmt1(f.totalPoints)}
          {delta != null && Math.abs(delta) >= 0.1 ? (
            <span className={'forecast-row__delta ' + (delta >= 0 ? 'forecast-row__delta--up' : 'forecast-row__delta--down')}>
              {delta >= 0 ? '▲' : '▼'}{fmt1(Math.abs(delta))}
            </span>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr className="forecast-row__detail">
          <td colSpan={6}>
            <div className="forecast-detail">
              <div className="forecast-detail__head">
                <span className="forecast-detail__full">{player.fullName}</span>
                <span className="muted forecast-detail__meta tabular">
                  {player.price != null ? `£${fmt1(player.price)}m` : ''}
                  {player.ownership != null ? ` · ${fmt1(player.ownership)}% owned` : ''}
                  {player.form != null ? ` · form ${fmt1(player.form)}` : ''}
                </span>
              </div>
              <div className="forecast-detail__stats">
                <span className="forecast-stat"><span className="forecast-stat__k muted">Proj mins</span><span className="tabular">{Number.isFinite(prob.projectedMins) ? prob.projectedMins : '—'}</span></span>
                <span className="forecast-stat"><span className="forecast-stat__k muted">Goal</span><span className="tabular">{pct(prob.goalLikelihood)}</span></span>
                <span className="forecast-stat"><span className="forecast-stat__k muted">Assist</span><span className="tabular">{pct(prob.assistLikelihood)}</span></span>
                <span className="forecast-stat"><span className="forecast-stat__k muted">Clean sheet</span><span className="tabular">{Number.isFinite(prob.cleanSheetPct) ? `${prob.cleanSheetPct}%` : '—'}</span></span>
                {player.position === 'GK' ? (
                  <span className="forecast-stat"><span className="forecast-stat__k muted">Saves</span><span className="tabular">{Number.isFinite(prob.projectedSaves) ? prob.projectedSaves : '—'}</span></span>
                ) : null}
              </div>
              <div className="forecast-detail__why muted">Why this projection — expected points by component:</div>
              <BreakdownBar forecast={f} />
              <div className="forecast-detail__note muted">
                xP {fmt1(f.totalPoints)} is the mean of the simulation. Outcomes are P(blank ≤2) /
                P(return ≥6) / P(haul ≥10); the range is the 10th–50th–90th percentile
                ({fmt1(pc.p10)} / {fmt1(pc.p50)} / {fmt1(pc.p90)}).
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function BreakdownBar({ forecast }) {
  const segs = breakdownSegments(forecast);
  const positives = segs.filter((s) => !s.negative);
  const total = positives.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="forecast-breakdown">
      <div className="forecast-breakdown__bar" aria-hidden="true">
        {positives.map((s) => (
          <span
            key={s.key}
            className={'forecast-seg ' + (SEG_CLASS[s.key] || 'forecast-seg--other')}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${fmt1(s.value)}`}
          />
        ))}
      </div>
      <ul className="forecast-breakdown__list">
        {segs.map((s) => (
          <li key={s.key} className={'forecast-breakdown__item' + (s.negative ? ' forecast-breakdown__item--neg' : '')}>
            <span className={'forecast-dot ' + (SEG_CLASS[s.key] || 'forecast-seg--other')} aria-hidden="true" />
            <span className="forecast-breakdown__seg-label">{s.label}</span>
            <span className="tabular forecast-breakdown__seg-val">{s.value > 0 ? '+' : ''}{fmt1(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchupPreview({ matchups, byId }) {
  const rows = useMemo(() => {
    return (matchups || []).map((m) => {
      const homeIds = m.home?.elementIds ?? [];
      const awayIds = m.away?.elementIds ?? [];
      const hasXp = homeIds.length > 0 && awayIds.length > 0;
      const homeDist = teamForecastDistribution(byId, homeIds);
      const awayDist = teamForecastDistribution(byId, awayIds);
      const probs = hasXp ? h2hWinProbs(homeDist, awayDist) : null;
      const lean = hasXp ? matchupLean(homeDist.mu, awayDist.mu) : null;
      return { ...m, homeDist, awayDist, probs, lean, hasXp };
    });
  }, [matchups, byId]);

  if (!rows.length) {
    return (
      <p className="muted forecast-matchup__empty">
        H2H matchup previews appear once lineups are set for the upcoming gameweek. Win odds come
        from each team's full score distribution, not just the summed expected total.
      </p>
    );
  }
  return (
    <div className="forecast-matchups">
      {rows.map((m) => (
        <div key={m.id} className="forecast-matchup">
          <div className="forecast-matchup__row">
            <div className="forecast-matchup__side">
              <span className="forecast-matchup__team">{m.home?.name}</span>
              <span className="tabular forecast-matchup__xp">
                {m.hasXp ? fmt1(m.homeDist.mu) : '—'}
                {m.hasXp ? (
                  <span className="muted forecast-matchup__range tabular"> ({m.homeDist.low}–{m.homeDist.high})</span>
                ) : null}
              </span>
            </div>
            <div className="forecast-matchup__mid">
              {m.lean ? (
                <span className={'forecast-matchup__lean forecast-matchup__lean--' + m.lean.favorite}>
                  {m.lean.favorite === 'level' ? 'level' : `+${fmt1(m.lean.diff)}`}
                </span>
              ) : (
                <span className="muted forecast-matchup__lean">vs</span>
              )}
            </div>
            <div className="forecast-matchup__side forecast-matchup__side--away">
              <span className="tabular forecast-matchup__xp">
                {m.hasXp ? fmt1(m.awayDist.mu) : '—'}
                {m.hasXp ? (
                  <span className="muted forecast-matchup__range tabular"> ({m.awayDist.low}–{m.awayDist.high})</span>
                ) : null}
              </span>
              <span className="forecast-matchup__team">{m.away?.name}</span>
            </div>
          </div>
          {m.probs ? (
            <div className="forecast-matchup__odds" role="img" aria-label={`Win ${m.probs.homeWinPct}%, draw ${m.probs.drawPct}%, loss ${m.probs.awayWinPct}%`}>
              <div className="forecast-matchup__oddsbar">
                <span className="forecast-matchup__win-h" style={{ width: `${m.probs.homeWinPct}%` }} />
                <span className="forecast-matchup__draw" style={{ width: `${m.probs.drawPct}%` }} />
                <span className="forecast-matchup__win-a" style={{ width: `${m.probs.awayWinPct}%` }} />
              </div>
              <div className="forecast-matchup__oddslabels">
                <span>{Math.round(m.probs.homeWinPct)}% win</span>
                <span className="muted">{Math.round(m.probs.drawPct)}% draw</span>
                <span>{Math.round(m.probs.awayWinPct)}% win</span>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const SORT_COLS = [
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'position', label: 'Pos' },
  { key: 'totalPoints', label: 'Tier' },
  { key: 'haul', label: 'Outlook', align: 'left' },
  { key: 'ceiling', label: 'Range' },
  { key: 'totalPoints', label: 'xP' },
];

export default function ForecastPanel({ matchups = [], fplContext = null }) {
  const { predictions, health, loading, error } = usePredictions();
  const [position, setPosition] = useState(null);
  const [team, setTeam] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('totalPoints');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  const basePlayers = predictions?.players ?? null;
  // Confirmed lineups (T-75 Pulselive / T-60 ESPN) overlay confirmed roles onto the
  // static forecast once an FPL context is supplied; inert (empty map) otherwise.
  const { roleMap, confirmedCount, active: lineupsActive } = useConfirmedLineups({
    players: basePlayers,
    gwFixtures: fplContext?.gwFixtures ?? null,
    teamById: fplContext?.teamById ?? null,
    elementById: fplContext?.elementById ?? null,
    enabled: !!fplContext,
  });

  const players = useMemo(
    () => applyConfirmedRolesToPlayers(basePlayers ?? [], roleMap),
    [basePlayers, roleMap],
  );

  const byId = useMemo(() => predictionsById({ players }), [players]);
  const teams = useMemo(() => teamsInPredictions(predictions), [predictions]);
  const rows = useMemo(
    () => filterAndSortPlayers(players, { position, team: team || null, query, sortKey, sortDir }),
    [players, position, team, query, sortKey, sortDir],
  );

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  if (loading) {
    return <p className="muted forecast-state">Loading forecast…</p>;
  }
  if (error || !predictions) {
    return <p className="muted forecast-state">Forecast unavailable right now.</p>;
  }
  if (predictions.gameweek == null || !(predictions.players?.length)) {
    return (
      <div className="forecast-state">
        <HealthStrip predictions={predictions} health={health} />
        <p className="muted forecast-state__empty">
          {predictions.note ||
            'No upcoming gameweek to forecast yet — check back once the season is underway.'}
        </p>
      </div>
    );
  }

  return (
    <div className="forecast-panel">
      <HealthStrip
        predictions={predictions}
        health={health}
        lineupsActive={lineupsActive}
        confirmedCount={confirmedCount}
      />

      <section className="forecast-section" aria-label="Matchup previews">
        <h3 className="forecast-section__title">Matchup previews</h3>
        <MatchupPreview matchups={matchups} byId={byId} />
      </section>

      <section className="forecast-section" aria-label="Player forecasts">
        <div className="forecast-toolbar">
          <div className="forecast-filters" role="group" aria-label="Position filter">
            <button
              type="button"
              className={'forecast-pill' + (position == null ? ' forecast-pill--active' : '')}
              onClick={() => setPosition(null)}
            >
              All
            </button>
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={'forecast-pill' + (position === p ? ' forecast-pill--active' : '')}
                onClick={() => setPosition((cur) => (cur === p ? null : p))}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="forecast-controls">
            <select
              className="forecast-select"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Team filter"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="search"
              className="forecast-search"
              placeholder="Search player…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players"
            />
          </div>
        </div>

        <div className="table-scroll forecast-table-wrap">
          <table className="forecast-table">
            <thead>
              <tr>
                {SORT_COLS.map((c) => (
                  <th
                    key={c.label}
                    scope="col"
                    className={
                      (c.align === 'left' ? 'forecast-th--left ' : 'tabular ') +
                      'forecast-th' +
                      (sortKey === c.key ? ' forecast-th--sorted' : '')
                    }
                    onClick={() => onSort(c.key)}
                    title={`Sort by ${c.label}`}
                  >
                    {c.label}
                    {sortKey === c.key ? <span className="forecast-th__dir">{sortDir === 'desc' ? ' ▼' : ' ▲'}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted forecast-table__empty">
                    No players match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <ForecastRow
                    key={p.id}
                    player={p}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="muted forecast-footnote">
          Showing {rows.length} of {predictions.players.length} players. Tiers, outlook odds and the
          range come from a Monte Carlo simulation — tap a row for the full breakdown and the raw xP.
        </p>
      </section>
    </div>
  );
}
