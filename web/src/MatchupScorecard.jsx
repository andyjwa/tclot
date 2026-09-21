import { FittedTeamName } from './LiveFaceOffRow.jsx';
import { TeamAvatar } from './TeamAvatar';
import { HeroVillainAvatarFrame } from './HeroVillainAvatarFrame.jsx';
import { liveFixtureLead } from './liveScoresDerivations.js';
import { englishOrdinal } from './playerContributionEvents.js';
import { matchupVillainVictoryLine } from './teamNameUtils.js';
import './LiveOddsSection.css';

/**
 * Shared H2H matchup "scorecard" presentation (the `.lo-*` card look locked
 * on the Live Odds tile): tinted meta strip (seed label + to-play counts or
 * the favourite's odds), edge-aligned crest/name/score header with the
 * winner glass pill, and the players-remaining centre gauge. Used by BOTH:
 *
 *  - the Scores tab's Live Scores fixture list (via {@link MatchupScorecard},
 *    where tapping a card opens that fixture's game card — mobile swipe deck
 *    or desktop fixture page); and
 *  - the Live Odds tile (which composes {@link MatchupMeta} and
 *    {@link MatchupHeader} directly inside its own expand/collapse toggle).
 */

/**
 * Tinted banner strip opening each matchup card (combined-cards mockup "C"):
 * the seeding label ("1st vs 5th", each team's live competition rank) as
 * faded ghost text on the left, and — in the SAME ghost treatment on the
 * right — either the caller's `rightText` (the Live Scores scorecard passes
 * the favourite's odds, e.g. `Mordor SFG 92%`) or the default to-play counts
 * ("10 v 11 to play", flipping to "FT" once both sides are done). A villain
 * victory parks sentence-case copy (`Regorasu is a villain!`, or
 * `couple of villains!` when both sides drew at the bottom of the GW
 * table) in the empty centre, in Scorebook lilac. Either side renders
 * independently — a missing
 * rank (off-season standings) or missing squad payload never blanks the
 * whole strip. Renders nothing when neither label nor a villain line is
 * available.
 */
export function MatchupMeta({
  fixture: f,
  liveRankByEntry,
  rightText,
  villainLine = null,
}) {
  const homeRank = Number(liveRankByEntry?.[f.homeId]);
  const awayRank = Number(liveRankByEntry?.[f.awayId]);
  const seedLabel =
    Number.isFinite(homeRank) && Number.isFinite(awayRank)
      ? `${englishOrdinal(homeRank)} vs ${englishOrdinal(awayRank)}`
      : null;
  const hasRemaining =
    f.homeRemaining != null &&
    Number.isFinite(Number(f.homeRemaining)) &&
    f.awayRemaining != null &&
    Number.isFinite(Number(f.awayRemaining));
  const toPlayLabel = hasRemaining
    ? Number(f.homeRemaining) === 0 && Number(f.awayRemaining) === 0
      ? 'FT'
      : `${f.homeRemaining} v ${f.awayRemaining} to play`
    : null;
  const right = rightText ?? toPlayLabel;
  if (!seedLabel && !right && !villainLine) return null;
  return (
    <div className={'lo-meta' + (villainLine ? ' lo-meta--villain' : '')}>
      <span className="lo-meta__text">{seedLabel}</span>
      {villainLine ? (
        <span className="lo-meta__villain">{villainLine}</span>
      ) : null}
      {right ? (
        <span className="lo-meta__text lo-meta__text--end">{right}</span>
      ) : villainLine ? (
        <span className="lo-meta__text lo-meta__text--end" />
      ) : null}
    </div>
  );
}

/**
 * Players-remaining centre gauge (scorecard mockup Option C, locked): one
 * shared strip split by a centre notch, grey when all 11 starters are still
 * to play, each half filling green from the CENTRE notch toward its outer
 * edge as players finish — the grey remainder sits beside the count that
 * quantifies it, and a fully green strip reads as full time. The count of
 * players left sits at each outer end, flipping to a green `FT` at 0.
 * Renders nothing when neither side has a usable count (missing squad
 * payloads); a one-sided gap keeps its half's track empty rather than
 * blanking the whole row.
 */
export function RemainingGauge({ homeRemaining, awayRemaining }) {
  const XI = 11;
  const norm = (n) =>
    n != null && Number.isFinite(Number(n))
      ? Math.max(0, Math.min(XI, Math.floor(Number(n))))
      : null;
  const home = norm(homeRemaining);
  const away = norm(awayRemaining);
  if (home == null && away == null) return null;
  const playedPct = (r) => ((XI - r) / XI) * 100;
  const sideAria = (r, side) =>
    r == null
      ? undefined
      : r === 0
        ? `${side} team — all 11 starters have finished their fixtures`
        : `${side} team — ${r} starter${r === 1 ? '' : 's'} still to play`;
  const label = (r) => (
    <span
      className={'lo-gauge__label' + (r === 0 ? ' lo-gauge__label--ft' : '')}
    >
      {r == null ? '' : r === 0 ? 'FT' : r}
    </span>
  );
  return (
    <div
      className="lo-gauge"
      aria-label={[sideAria(home, 'Home'), sideAria(away, 'Away')]
        .filter(Boolean)
        .join('; ')}
    >
      {label(home)}
      <span className="lo-gauge__track" aria-hidden="true">
        <span className="lo-gauge__side lo-gauge__side--home">
          {home != null ? (
            <span
              className={
                'lo-gauge__fill' + (home === 0 ? ' lo-gauge__fill--ft' : '')
              }
              style={{ width: `${playedPct(home)}%` }}
            />
          ) : null}
        </span>
        <span className="lo-gauge__notch" />
        <span className="lo-gauge__side lo-gauge__side--away">
          {away != null ? (
            <span
              className={
                'lo-gauge__fill' + (away === 0 ? ' lo-gauge__fill--ft' : '')
              }
              style={{ width: `${playedPct(away)}%` }}
            />
          ) : null}
        </span>
      </span>
      {label(away)}
    </div>
  );
}

/**
 * Crest slot for one side of the header. When the side carries a hero /
 * villain narrative status the avatar keeps the Variant 1 tinted ring
 * (compact variant — ring only, no caption slot); otherwise the avatar
 * renders untreated.
 */
function MatchupCrest({ entryId, name, status, teamLogoMap, kitIndexByEntry }) {
  const avatar = (
    <TeamAvatar
      entryId={entryId}
      name={name}
      size="sm"
      logoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
    />
  );
  return (
    <span className="lo-hdr__crest">
      {status ? (
        <HeroVillainAvatarFrame status={status} size="compact">
          {avatar}
        </HeroVillainAvatarFrame>
      ) : (
        avatar
      )}
    </span>
  );
}

/**
 * Edge-aligned matchup header (mockup "C2"): crest pinned to the outer edge,
 * fitted team name beside it, and the score alone in the centre with the
 * Scores-tab winner "glass" pill behind the leading number. Reads left →
 * right with no full-width bars competing for the same line.
 *
 * `homeDisplayName` / `awayDisplayName` (optional) feed the fitted name's
 * preferred candidate — the Scores list passes the curated mobile short
 * label there so phones try e.g. `Mordor SFG` before falling back further.
 * `homeStatus` / `awayStatus` (optional) add the hero/villain avatar ring.
 */
export function MatchupHeader({
  fixture: f,
  teamLogoMap,
  kitIndexByEntry,
  homeDisplayName,
  awayDisplayName,
  homeStatus = null,
  awayStatus = null,
}) {
  const lead = liveFixtureLead(f.homeLive, f.awayLive);
  const bothScores = f.homeLive != null && f.awayLive != null;
  return (
    <div className="lo-hdr">
      <div className="lo-hdr__side">
        <MatchupCrest
          entryId={f.homeId}
          name={f.homeName}
          status={homeStatus}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <FittedTeamName
          className={
            'lo-hdr__name' + (homeStatus === 'villain' ? ' lo-hdr__name--villain' : '')
          }
          fullName={f.homeName}
          displayName={homeDisplayName}
          title={f.homeName}
        />
      </div>
      <div className="lo-hdr__score" aria-label="Gameweek score">
        {bothScores ? (
          <>
            <span
              className={
                'lo-hdr__half' + (lead === 'home' ? ' lo-hdr__half--winner' : '')
              }
            >
              {f.homeLive}
            </span>
            <span className="lo-hdr__sep" aria-hidden="true">
              –
            </span>
            <span
              className={
                'lo-hdr__half' + (lead === 'away' ? ' lo-hdr__half--winner' : '')
              }
            >
              {f.awayLive}
            </span>
          </>
        ) : (
          <span className="lo-hdr__pending muted">vs</span>
        )}
      </div>
      <div className="lo-hdr__side lo-hdr__side--away">
        <FittedTeamName
          className={
            'lo-hdr__name' + (awayStatus === 'villain' ? ' lo-hdr__name--villain' : '')
          }
          fullName={f.awayName}
          displayName={awayDisplayName}
          title={f.awayName}
        />
        <MatchupCrest
          entryId={f.awayId}
          name={f.awayName}
          status={awayStatus}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      </div>
    </div>
  );
}

/**
 * Composed scorecard — one full `.lo-matchup` card in the locked Live Scores
 * treatment: tinted meta strip (seed label left, favourite's odds right via
 * `metaRight`, falling back to the to-play counts), the crest/name/score
 * header, and the players-remaining centre gauge ({@link RemainingGauge}).
 * With `onClick` the whole card becomes a single navigation button
 * (`.lo-matchup--nav`): the Live Scores list uses this to open the tapped
 * fixture's game card (mobile swipe deck / desktop fixture page).
 *
 * @param {{
 *   fixture: object,            // cardFixtures row from LiveScores
 *   metaRight?: string | null,  // favourite odds label; null → to-play text
 *   liveRankByEntry?: object,   // entry id → unique live place (1–8)
 *   teamLogoMap: object,
 *   kitIndexByEntry?: object,
 *   homeDisplayName?: string,
 *   awayDisplayName?: string,
 *   homeStatus?: 'hero' | 'villain' | null,
 *   awayStatus?: 'hero' | 'villain' | null,
 *   onClick?: () => void,
 *   className?: string,
 * }} props
 */
export function MatchupScorecard({
  fixture,
  metaRight = null,
  liveRankByEntry,
  teamLogoMap,
  kitIndexByEntry,
  homeDisplayName,
  awayDisplayName,
  homeStatus = null,
  awayStatus = null,
  onClick,
  className,
}) {
  const Head = onClick ? 'button' : 'div';
  const villainLine = matchupVillainVictoryLine({
    homeName: fixture.homeName,
    awayName: fixture.awayName,
    homeVillain: homeStatus === 'villain',
    awayVillain: awayStatus === 'villain',
  });
  return (
    <div
      className={
        'lo-matchup' +
        (onClick ? ' lo-matchup--nav' : '') +
        (className ? ' ' + className : '')
      }
    >
      <Head
        className="lo-matchup__head"
        {...(onClick ? { type: 'button', onClick } : {})}
      >
        <MatchupMeta
          fixture={fixture}
          liveRankByEntry={liveRankByEntry}
          rightText={metaRight}
          villainLine={villainLine}
        />
        <MatchupHeader
          fixture={fixture}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          homeDisplayName={homeDisplayName}
          awayDisplayName={awayDisplayName}
          homeStatus={homeStatus}
          awayStatus={awayStatus}
        />
        <RemainingGauge
          homeRemaining={fixture.homeRemaining}
          awayRemaining={fixture.awayRemaining}
        />
      </Head>
    </div>
  );
}
