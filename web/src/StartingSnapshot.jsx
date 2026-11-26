import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';
import {
  STARTING_SCOPE_GW,
  STARTING_SCOPE_UPCOMING,
  buildStartingSnapshot,
  listGameweekFixtures,
} from './startingSnapshot.js';

function plBadgeUrl(code) {
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `https://resources.premierleague.com/premierleague/badges/50/t${n}.png`;
}

function kickoffLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function minuteLabel(minute) {
  if (!minute) return 'Live';
  return `${String(minute).replace(/['′]$/, '')}′`;
}

function roleTag(role) {
  if (role === 'bench') return 'Bench';
  if (role === 'nis') return 'Out';
  return '';
}

function Crest({ code }) {
  const src = plBadgeUrl(code);
  if (!src) return null;
  return <img className="start-dd__crest" src={src} alt="" />;
}

function CheckMenu({ label, value, options, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((opt) => Object.is(opt.value, value)) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`start-dd${open ? ' is-open' : ''}${align === 'right' ? ' start-dd--right' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`start-dd__btn${selected?.marked ? ' is-set' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="start-dd__label">{label}</span>
        <span className="start-dd__value">{selected?.trigger}</span>
        <span className="start-dd__caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <ul className="start-dd__menu" id={listId} role="listbox" aria-label={label}>
          {options.map((opt) => {
            if (opt.type === 'sep') {
              return (
                <li key={opt.key} className="start-dd__sep" role="presentation">
                  {opt.trigger}
                </li>
              );
            }
            const on = Object.is(opt.value, value);
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`start-dd__opt${on ? ' is-on' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className={`start-dd__tick${on ? ' is-on' : ''}`} aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span className="start-dd__opt-body">{opt.node || opt.trigger}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function PlayerLine({ player }) {
  const tag = roleTag(player.role);
  const when = player.live
    ? minuteLabel(player.minute)
    : player.fullTime
      ? 'FT'
      : kickoffLabel(player.kickoffIso);
  return (
    <li className="prem-start__player">
      <span className="prem-start__pos">{player.pos}</span>
      <Crest code={player.clubCode} />
      <span className="prem-start__who">
        <ClickablePlayerName
          element={player.elementId}
          displayName={player.name}
          web_name={player.name}
          teamShort={player.clubShort}
          className="prem-start__name"
        >
          {player.name}
        </ClickablePlayerName>
        {player.onFantasyBench ? (
          <span
            className="prem-owner-bench"
            title="On fantasy bench"
            aria-label="On fantasy bench"
          >
            🪑
          </span>
        ) : null}
      </span>
      <span className="prem-start__meta">
        {tag ? <span className={`prem-start__tag prem-start__tag--${player.role}`}>{tag}</span> : null}
        <span className="prem-start__opp">
          {when ? `${when} · ` : ''}v {player.oppShort}
        </span>
      </span>
    </li>
  );
}

function Column({ title, players, empty }) {
  return (
    <div className="prem-start__col">
      <h3>
        {title}
        <span>{players.length}</span>
      </h3>
      {players.length ? (
        <ul className="prem-start__list">
          {players.map((player) => (
            <PlayerLine key={`${player.elementId}-${player.fixtureId}-${player.role}`} player={player} />
          ))}
        </ul>
      ) : (
        <p className="prem-start__empty">{empty}</p>
      )}
    </div>
  );
}

/**
 * Starting / not starting snapshot for the Lineups page.
 * Lineups mode keeps the fixture sheets; this is the other mode.
 */
export function StartingSnapshot({
  fixtures,
  squads,
  elementById,
  teamById,
  narrow,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const [teamId, setTeamId] = useState(null);
  const [fixtureFilter, setFixtureFilter] = useState(STARTING_SCOPE_UPCOMING);

  const gameweekFixtures = useMemo(
    () => listGameweekFixtures(fixtures, teamById),
    [fixtures, teamById],
  );
  const activeFilter = gameweekFixtures.some((fx) => fx.id === fixtureFilter)
    ? fixtureFilter
    : fixtureFilter === STARTING_SCOPE_GW
      ? STARTING_SCOPE_GW
      : STARTING_SCOPE_UPCOMING;
  const activeFixtureId = typeof activeFilter === 'number' ? activeFilter : null;

  const snap = useMemo(
    () =>
      buildStartingSnapshot({
        fixtures,
        squads,
        elementById,
        teamById,
        teamId,
        fixtureId: activeFixtureId,
        scope: activeFixtureId == null ? activeFilter : 'fixture',
      }),
    [fixtures, squads, elementById, teamById, teamId, activeFixtureId, activeFilter],
  );

  const teams = (squads || []).filter((squad) => squad && !squad.error && squad.teamName);
  const teamOptions = [
    { key: 'everyone', value: null, trigger: 'Everyone', marked: false, node: 'Everyone' },
    ...teams.map((squad) => ({
      key: `team-${squad.leagueEntryId}`,
      value: Number(squad.leagueEntryId),
      trigger: squad.teamName,
      marked: true,
      node: (
        <span className="start-dd__team">
          <TeamAvatar
            entryId={squad.fplEntryId}
            name={squad.teamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
          <span>{squad.teamName}</span>
        </span>
      ),
    })),
  ];
  const fixtureOptions = [
    {
      key: 'gw',
      value: STARTING_SCOPE_GW,
      trigger: 'Full game week',
      marked: false,
      node: 'Full game week',
    },
    {
      key: 'upcoming',
      value: STARTING_SCOPE_UPCOMING,
      trigger: 'Upcoming games',
      marked: false,
      node: 'Upcoming games',
    },
    { key: 'sep', type: 'sep', trigger: 'Fixtures' },
    ...gameweekFixtures.map((fx) => ({
      key: `fx-${fx.id}`,
      value: fx.id,
      trigger: `${fx.homeShort} v ${fx.awayShort}`,
      marked: true,
      node: (
        <span className="start-dd__fix">
          <Crest code={fx.homeCode} />
          <span>{fx.homeShort}</span>
          <span className="start-dd__v">v</span>
          <Crest code={fx.awayCode} />
          <span>{fx.awayShort}</span>
          {fx.live ? <span className="start-dd__live">{minuteLabel(fx.minute)}</span> : null}
          {fx.fullTime ? <span className="start-dd__ft">FT</span> : null}
        </span>
      ),
    })),
  ];

  const selectedTeam = teams.find((squad) => Number(squad.leagueEntryId) === teamId);
  const selectedFixture = gameweekFixtures.find((fx) => fx.id === activeFixtureId);
  const fixtureLabel = selectedFixture
    ? `${selectedFixture.homeName} v ${selectedFixture.awayName}`
    : '';
  const upcomingAnnounced = gameweekFixtures.some((fx) => fx.announced && !fx.kickedOff);
  const anyAnnounced = gameweekFixtures.some((fx) => fx.announced);

  const visibleGroups = snap.groups.filter(
    (group) => group.starting.length || group.notStarting.length,
  );

  let status = '';
  if (visibleGroups.length === 0) {
    if (activeFilter === STARTING_SCOPE_UPCOMING && !upcomingAnnounced) {
      status = 'No sheets are out yet. They usually land about 75 minutes before kickoff.';
    } else if (activeFilter === STARTING_SCOPE_GW && !anyAnnounced) {
      status = 'No sheets are out yet. They usually land about 75 minutes before kickoff.';
    } else if (selectedFixture && !selectedFixture.announced) {
      status = `Lineups are not out yet for ${fixtureLabel}.`;
    } else if (selectedTeam && fixtureLabel) {
      status = `${selectedTeam.teamName} has nobody in ${fixtureLabel}.`;
    } else if (selectedTeam && activeFilter === STARTING_SCOPE_UPCOMING) {
      status = `${selectedTeam.teamName} has nobody in the upcoming sheets.`;
    } else if (selectedTeam) {
      status = `${selectedTeam.teamName} has nobody in this gameweek's sheets.`;
    } else if (fixtureLabel) {
      status = `Nobody in the league is in ${fixtureLabel}.`;
    } else {
      status = 'No players match this filter.';
    }
  } else {
    const { starting, notStarting } = snap.totals;
    status = `${starting} starting · ${notStarting} not starting`;
  }

  return (
    <section className="prem-start" aria-label="Starting">
      <div className="prem-start__filters">
        <CheckMenu label="Team" value={teamId} options={teamOptions} onChange={setTeamId} />
        <CheckMenu
          label="Fixture"
          value={activeFilter}
          options={fixtureOptions}
          onChange={setFixtureFilter}
          align="right"
        />
      </div>
      <p className="prem-start__status" aria-live="polite">
        {status}
      </p>
      {visibleGroups.map((group) => (
        <article className="prem-start-card" key={group.leagueEntryId}>
          <header className="prem-start__teamhead">
            <TeamAvatar
              entryId={group.fplEntryId}
              name={group.teamName}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
            <h2 className="prem-start__teamname">{group.teamName}</h2>
          </header>
          <div className={`prem-start__split${narrow ? ' is-narrow' : ''}`}>
            <Column title="Starting" players={group.starting} empty="None" />
            <Column title="Not starting" players={group.notStarting} empty="None" />
          </div>
        </article>
      ))}
    </section>
  );
}
