import { useState } from 'react';
import { WOODEN_SPOON_MANAGER_SURNAME, REIGNING_CHAMPION_MANAGER_SURNAME } from './championOfRecord.js';
import './EndOfSeasonSplash.css';

/**
 * Per-tab session cap on how many times the End-of-Season cinematic plays
 * back automatically. After the cap is reached the splash still shows, but
 * as a static final-state tableau (Tery sat in front of the assembled
 * bathroom puzzle) — the user can still hit Replay manually.
 */
const SESSION_PLAY_KEY = 'tclot:eos:plays:v1';
const SESSION_PLAY_CAP = 2;

/**
 * Three-act End-of-Season cinematic that plays on the live scores page
 * once the FPL season is complete. See EndOfSeasonSplash.css for the
 * full keyframe timeline; the structure mirrors GuardOfHonourSplash:
 *
 *   ACT 1 — Title (~0–7s)
 *     The TCLOT brand banner image (the same `/brand/tclot-header.jpg`
 *     used in the League Info modal — already carries the lion +
 *     wordmark + Korean/Canadian/British flags) fades in. Three text
 *     lines stagger in below it: an "END OF SEASON" eyebrow, a
 *     "Celebrating another season of TCLOT" headline, and a "Thanks
 *     to all managers that participated" sub-line.
 *
 *   ACT 2 — Higman in the nightclub (~7–25s)
 *     A 2D top-down nightclub: dark dance floor with disco-light cones
 *     flickering magenta/cyan/yellow, six dancing dots scattered on the
 *     floor, a velvet-roped VIP enclosure top-right with three long-
 *     haired magenta/purple dots and two champagne bottles on a couch-
 *     side table. Higman (the same red dot + gold ring + crown glyph
 *     used in the Guard of Honour) walks in from off-screen left,
 *     dances through three on-floor waypoints, approaches the rope,
 *     and seats himself in VIP. Champagne bottles pop as he sits down.
 *
 *   ACT 3 — Bathroom puzzle (~25–46s)
 *     A 2D top-down bathroom: walled room with a door at the top, a
 *     bath on the left, a toilet on the right. Tery (a black dot, the
 *     same family as the GoH security guards) walks in from the door
 *     and sits in front of a 4×3 puzzle grid. Twelve scattered puzzle
 *     pieces snap into their slots one by one (1.2s stagger), so the
 *     punishment lands cinematically: he is sentenced to assemble the
 *     puzzle in this enclosed space because he "couldn't find space".
 *     Caption stack ("THE PUNISHMENT" / "Couldn't find space") is held
 *     for the rest of the run.
 *
 * The cinematic auto-plays up to SESSION_PLAY_CAP times per browser
 * tab, with manual Replay always available, and respects
 * `prefers-reduced-motion: reduce` by snapping to the final-state
 * tableau (Tery seated, puzzle assembled, captions visible). Trigger /
 * mount lives in LiveScores.jsx — production trigger is "season
 * complete" (`liveStatus.status === 'idle' && nextGw == null`),
 * previewable any time via the `?eosSplash=1` URL flag.
 *
 * @param {{ onDismiss?: () => void }} props
 */
export function EndOfSeasonSplash({ onDismiss }) {
  /**
   * Playback state machine — same lazy-init session-cap reader the
   * Guard of Honour splash uses. Manual Replay always bumps `playId`
   * regardless of the cap so the user can re-watch on demand; the
   * `playId` becomes the SVG element's React `key`, forcing a fresh
   * mount and therefore a fresh run of every CSS animation.
   */
  const [playId, setPlayId] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const n = Number(window.sessionStorage.getItem(SESSION_PLAY_KEY) ?? '0');
      if (!Number.isFinite(n) || n >= SESSION_PLAY_CAP) return 0;
      window.sessionStorage.setItem(SESSION_PLAY_KEY, String(n + 1));
      return n + 1;
    } catch {
      return 1;
    }
  });
  const isPlaying = playId > 0;
  const handleReplay = () => setPlayId((id) => id + 1);

  return (
    <div
      className={
        'eos-splash' +
        (isPlaying ? ' eos-splash--playing' : '') +
        (onDismiss ? '' : ' eos-splash--no-dismiss')
      }
      role="region"
      aria-label="End of season celebration"
    >
      {onDismiss ? (
        <button
          type="button"
          className="eos-splash__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss end-of-season splash"
        >
          <span className="eos-splash__dismiss-x" aria-hidden="true">×</span>
        </button>
      ) : null}

      <button
        type="button"
        className="eos-splash__replay"
        onClick={handleReplay}
        aria-label="Replay end-of-season animation"
      >
        <span className="eos-splash__replay-icon" aria-hidden="true">↻</span>
      </button>

      <svg
        key={playId}
        className="eos-splash__svg"
        viewBox="0 0 1024 576"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="End of season cinematic — TCLOT title card, Higman celebrating in a nightclub, then Tery completing a jigsaw puzzle in a bathroom as the punishment scene"
      >
        <defs>
          <radialGradient id="eos-higman-fill" cx="35%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#ff7878" />
            <stop offset="100%" stopColor="#b81818" />
          </radialGradient>

          <radialGradient id="eos-disco-ball" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#cdd2ff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#5a5a78" stopOpacity="0.85" />
          </radialGradient>

          <linearGradient id="eos-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1a26" />
            <stop offset="100%" stopColor="#0a0a14" />
          </linearGradient>

          <linearGradient id="eos-bath-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2438" />
            <stop offset="100%" stopColor="#1a1426" />
          </linearGradient>

          <linearGradient id="eos-bath-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34304a" />
            <stop offset="100%" stopColor="#22203a" />
          </linearGradient>
        </defs>

        {/* Solid base — sits behind every scene so the cross-fades
            between scenes don't briefly reveal the page background. */}
        <rect width="1024" height="576" fill="#0e0a1c" />

        <TitleScene />
        <ClubScene />
        <BramptonScene />
        <BathroomScene />
        <OutroScene />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCENE 1 — Title card.
 *
 * The TCLOT brand banner image (`/brand/tclot-header.jpg`) is reused
 * here verbatim from the League Info modal — it already carries the
 * lion icon, the white wordmark, the "Tri-Continental League of
 * Titans" subtitle, and the three country flags as one composed JPEG.
 * Embedded via SVG `<image>` with `preserveAspectRatio="xMidYMid meet"`
 * so it scales without distortion inside the title-area rectangle.
 *
 * Three text lines stagger in below the banner (each `<g>` carries
 * `--i` 0/1/2 to drive the 0.7s spacing in the CSS keyframe).         */
/* ------------------------------------------------------------------ */
function TitleScene() {
  return (
    <g className="eos-splash__scene eos-splash__scene--title">
      <image
        className="eos-splash__title-banner"
        href="/brand/tclot-header.jpg"
        x={TITLE_BANNER_X}
        y={TITLE_BANNER_Y}
        width={TITLE_BANNER_W}
        height={TITLE_BANNER_H}
        preserveAspectRatio="xMidYMid meet"
      />

      <g className="eos-splash__title-line" style={{ '--i': 0 }}>
        <text
          x="512"
          y={TITLE_LINE_EYEBROW_Y}
          textAnchor="middle"
          className="eos-splash__title-eyebrow"
        >
          END OF SEASON
        </text>
      </g>

      <g className="eos-splash__title-line" style={{ '--i': 1 }}>
        <text
          x="512"
          y={TITLE_LINE_HEADLINE_Y}
          textAnchor="middle"
          className="eos-splash__title-headline"
        >
          Celebrating another season of TCLOT
        </text>
      </g>

      <g className="eos-splash__title-line" style={{ '--i': 2 }}>
        <text
          x="512"
          y={TITLE_LINE_SUB_Y}
          textAnchor="middle"
          className="eos-splash__title-sub"
        >
          Let&apos;s check in on our League Champion and League Loser...
        </text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* SCENE 2 — Nightclub.
 *
 * 2D top-down arrangement (1024×576 viewBox):
 *   - Dance floor: dark rounded rect centre-stage (`FLOOR_*`)
 *   - VIP enclosure: top-right corner, roped off with two posts +
 *     velvet rope curve (`VIP_*` constants)
 *   - Bar counter at the back (`BAR_*`)
 *   - Two couches: one outside the VIP for atmosphere, one INSIDE the
 *     VIP that Higman ends up sitting on at the end of the scene
 *     (`COUCH_LEFT_*`, `COUCH_VIP_*`)
 *   - Couch-side table inside the VIP holding the champagne (`TABLE_*`)
 *   - Disco ball at the top (`DISCO_BALL_*`)
 *   - Six disco-light cones converging from the top corners onto the
 *     floor — flicker keyframe-driven, stagger via `--i`
 *   - Six dancing dots (`DANCERS`) on the floor, each with their own
 *     bob amplitude + index for the staggered `eos-dancer-bob`
 *   - Three "VIP dots" (long-haired magenta/purple — `VIPS`) seated
 *     on the VIP couch, looser bob
 *   - Two champagne bottles (`BOTTLES`) on the table, each with a
 *     pop-spray glyph keyed at t=22s
 *   - Higman dot — same red + gold-ring + crown treatment as the GoH,
 *     final SVG render position is the VIP couch, six waypoints
 *     consumed by `eos-higman-stroll` keyframe.                       */
/* ------------------------------------------------------------------ */
function ClubScene() {
  return (
    <g className="eos-splash__scene eos-splash__scene--club">
      <rect
        x={FLOOR_X}
        y={FLOOR_Y}
        width={FLOOR_W}
        height={FLOOR_H}
        rx="16"
        fill="url(#eos-floor)"
        stroke="#2a2440"
        strokeWidth="1.5"
      />

      {/* Bar fixture against the LEFT wall — top-down: a tall narrow
          counter rect, with bottle silhouettes lined up along the
          back-shelf strip closest to the wall and a small barman dot
          standing behind the counter on the staff side. Higman's
          W0 stop sits on the CUSTOMER side of the counter (just right
          of `BAR_X + BAR_W`), opposite the barman, so they read as
          facing each other across the bar. */}
      <g>
        {/* Counter body. */}
        <rect x={BAR_X} y={BAR_Y} width={BAR_W} height={BAR_H} rx="6" fill="#3a2f55" />
        {/* Customer-facing trim (right edge of the counter — closest
            to the dance floor). */}
        <rect x={BAR_X + BAR_W - 6} y={BAR_Y} width="6" height={BAR_H} fill="#5a4a85" />
        {/* Back-shelf strip against the wall — bottles live here. */}
        <rect x={BAR_X} y={BAR_Y} width="14" height={BAR_H} fill="#26203c" />
        {/* Seven bottles stacked vertically along the back shelf. */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={`bar-bottle-${i}`}
            x={BAR_X + 3}
            y={BAR_Y + 10 + i * 24}
            width="8"
            height="16"
            rx="1.5"
            fill={i % 2 === 0 ? '#6dd2a8' : '#d2c46d'}
            opacity="0.78"
          />
        ))}
        {/* Barman — small dark dot behind the counter on the staff
            side, level with Higman's W0 customer stop so the two read
            as facing each other across the counter. */}
        <circle
          cx={BARMAN_X}
          cy={BARMAN_Y}
          r={BARMAN_R}
          fill="#2a2438"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <circle
          cx={BARMAN_X}
          cy={BARMAN_Y - BARMAN_R * 0.4}
          r={BARMAN_R * 0.5}
          fill="#ffffff"
          opacity="0.18"
        />
        <text
          x={BARMAN_X}
          y={BARMAN_Y + BARMAN_R + 12}
          textAnchor="middle"
          className="eos-splash__label"
        >
          Barman
        </text>
      </g>

      {/* Atmosphere couch on the LEFT — not where Higman ends up; just
          dressing so the room reads as a club rather than a single
          floor + VIP island. */}
      <rect
        x={COUCH_LEFT_X}
        y={COUCH_LEFT_Y}
        width={COUCH_LEFT_W}
        height={COUCH_LEFT_H}
        rx="14"
        fill="#5a3f7a"
      />
      <rect
        x={COUCH_LEFT_X + 6}
        y={COUCH_LEFT_Y + 6}
        width={COUCH_LEFT_W - 12}
        height={COUCH_LEFT_H - 18}
        rx="10"
        fill="#7a5aa5"
      />

      {/* Disco ball — perpetual slow-rotate in the inner spin group.
          Outer translate places the (0, 0) pivot at the ball's centre. */}
      <g transform={`translate(${DISCO_BALL_X} ${DISCO_BALL_Y})`}>
        <g className="eos-splash__disco-ball-spin">
          <circle r={DISCO_BALL_R} fill="url(#eos-disco-ball)" />
          {/* Faint cross-hatch facets so the rotation reads visually. */}
          <path
            d={`M ${-DISCO_BALL_R} 0 L ${DISCO_BALL_R} 0 M 0 ${-DISCO_BALL_R} L 0 ${DISCO_BALL_R}`}
            stroke="#ffffff"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <circle r={DISCO_BALL_R} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
          <circle r={DISCO_BALL_R * 0.6} fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        </g>
        {/* Ball mount line — a thin rod up to the ceiling. */}
        <line x1="0" y1={-DISCO_BALL_R} x2="0" y2={-DISCO_BALL_R - 36} stroke="#3a3550" strokeWidth="2" />
      </g>

      {/* Six disco-light cones converging onto the floor. Each cone is
          a triangle from a top anchor down to two points on the dance
          floor; per-cone fill + opacity flicker is keyframe-driven via
          `--i` staggered phase. */}
      {DISCO_BEAMS.map((b, i) => (
        <polygon
          key={`beam-${i}`}
          className="eos-splash__disco-beam"
          points={`${b.ax},${b.ay} ${b.lx},${b.ly} ${b.rx},${b.ry}`}
          style={{ '--i': i }}
        />
      ))}

      {/* Six dancing dots scattered on the floor. Each carries a
          per-dot `--bob-dx` / `--bob-dy` (small viewBox-px offsets) and
          a `--i` stagger so the bob phase desyncs across the floor. */}
      {DANCERS.map((d, i) => (
        <g
          key={`dancer-${i}`}
          className="eos-splash__dancer"
          style={{
            '--i': i,
            '--bob-dx': `${d.bobDx}px`,
            '--bob-dy': `${d.bobDy}px`,
          }}
        >
          <circle cx={d.x} cy={d.y} r={DANCER_R} fill={d.fill} stroke="#0a0a0a" strokeOpacity="0.45" strokeWidth="1" />
          <circle cx={d.x} cy={d.y - DANCER_R * 0.4} r={DANCER_R * 0.5} fill="#ffffff" opacity="0.18" />
        </g>
      ))}

      {/* VIP enclosure — couch + rope. */}
      <VipEnclosure />

      {/* Higman — red dot + crown glyph, mirroring his treatment in
          the Guard of Honour splash (the gold ring was removed per
          design feedback). Final SVG render position is the centre
          of the VIP couch; the CSS keyframe translates him through
          seven waypoints (off-screen left → bar stop → dance floor →
          2 dance points → rope → inside VIP → couch). The speech
          bubble is rendered inside this same wrapper so it translates
          with him; its own keyframe gates visibility to the W0 pause. */}
      <g
        className="eos-splash__higman"
        style={{
          '--enter-dx': `${CLUB_HIGMAN_ENTRY_X - CLUB_HIGMAN_FINAL_X}px`,
          '--enter-dy': `${CLUB_HIGMAN_ENTRY_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w0-dx': `${CLUB_HIGMAN_W0_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w0-dy': `${CLUB_HIGMAN_W0_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w1-dx': `${CLUB_HIGMAN_W1_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w1-dy': `${CLUB_HIGMAN_W1_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w2-dx': `${CLUB_HIGMAN_W2_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w2-dy': `${CLUB_HIGMAN_W2_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w3-dx': `${CLUB_HIGMAN_W3_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w3-dy': `${CLUB_HIGMAN_W3_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w4-dx': `${CLUB_HIGMAN_W4_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w4-dy': `${CLUB_HIGMAN_W4_Y - CLUB_HIGMAN_FINAL_Y}px`,
          '--w5-dx': `${CLUB_HIGMAN_W5_X - CLUB_HIGMAN_FINAL_X}px`,
          '--w5-dy': `${CLUB_HIGMAN_W5_Y - CLUB_HIGMAN_FINAL_Y}px`,
        }}
      >
        <g className="eos-splash__higman-bob">
          <circle
            cx={CLUB_HIGMAN_FINAL_X}
            cy={CLUB_HIGMAN_FINAL_Y}
            r={HIGMAN_R}
            fill="url(#eos-higman-fill)"
          />
          <CrownGlyph cx={CLUB_HIGMAN_FINAL_X} cy={CLUB_HIGMAN_FINAL_Y - 1} scale={0.32} />
        </g>
        <text
          x={CLUB_HIGMAN_FINAL_X}
          y={CLUB_HIGMAN_FINAL_Y + HIGMAN_R + 14}
          textAnchor="middle"
          className="eos-splash__label"
        >
          {REIGNING_CHAMPION_MANAGER_SURNAME}
        </text>

        {/* Speech bubble — Higman ordering at the bar. Rendered in
            wrapper-local coords offset from his FINAL position so that
            when the keyframe translates him to W0, the bubble appears
            above and to the right of him at the bar. Default opacity
            is 0; `eos-speech-bubble-pop` only briefly reveals it
            during the W0 pause window. The path describes a rounded
            rectangle with a small triangular tail jutting down-left
            toward Higman's head. */}
        <g className="eos-splash__speech-bubble">
          <path
            d={
              `M ${SPEECH_BUBBLE_X + 10} ${SPEECH_BUBBLE_Y}` +
              ` H ${SPEECH_BUBBLE_X + SPEECH_BUBBLE_W - 10}` +
              ` Q ${SPEECH_BUBBLE_X + SPEECH_BUBBLE_W} ${SPEECH_BUBBLE_Y},` +
              ` ${SPEECH_BUBBLE_X + SPEECH_BUBBLE_W} ${SPEECH_BUBBLE_Y + 10}` +
              ` V ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H - 10}` +
              ` Q ${SPEECH_BUBBLE_X + SPEECH_BUBBLE_W} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H},` +
              ` ${SPEECH_BUBBLE_X + SPEECH_BUBBLE_W - 10} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H}` +
              ` H ${SPEECH_BUBBLE_X + 38}` +
              ` L ${SPEECH_BUBBLE_X + 14} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H + 22}` +
              ` L ${SPEECH_BUBBLE_X + 26} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H}` +
              ` H ${SPEECH_BUBBLE_X + 10}` +
              ` Q ${SPEECH_BUBBLE_X} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H},` +
              ` ${SPEECH_BUBBLE_X} ${SPEECH_BUBBLE_Y + SPEECH_BUBBLE_H - 10}` +
              ` V ${SPEECH_BUBBLE_Y + 10}` +
              ` Q ${SPEECH_BUBBLE_X} ${SPEECH_BUBBLE_Y},` +
              ` ${SPEECH_BUBBLE_X + 10} ${SPEECH_BUBBLE_Y} Z`
            }
            fill="#ffffff"
            stroke="#1a1a26"
            strokeWidth="1.6"
          />
          <text
            x={SPEECH_BUBBLE_X + SPEECH_BUBBLE_W / 2}
            y={SPEECH_BUBBLE_Y + 22}
            textAnchor="middle"
            className="eos-splash__bubble-text"
          >
            One Blackcurrant &amp; Soda please fella,
          </text>
          <text
            x={SPEECH_BUBBLE_X + SPEECH_BUBBLE_W / 2}
            y={SPEECH_BUBBLE_Y + 42}
            textAnchor="middle"
            className="eos-splash__bubble-text"
          >
            we&apos;re celebrating
          </text>
        </g>
      </g>
    </g>
  );
}

/**
 * VIP enclosure — couch + table + 3 long-haired magenta/purple dots +
 * 2 champagne bottles + 2 pop sprays + a velvet rope curving across
 * the open side. Pulled out as its own sub-component just to keep the
 * top-level ClubScene readable.
 */
function VipEnclosure() {
  return (
    <g>
      {/* "VIP" label backplate — a small gold tag pinned to the rope. */}
      <rect x={VIP_LABEL_X} y={VIP_LABEL_Y} width="42" height="18" rx="3" fill="#ffd166" />
      <text
        x={VIP_LABEL_X + 21}
        y={VIP_LABEL_Y + 13}
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        fill="#1a1a1c"
        letterSpacing="0.1em"
      >
        VIP
      </text>

      {/* VIP couch — back cushion + seat — same purple palette as the
          atmosphere couch on the left, just longer to seat 3 VIPs +
          Higman. */}
      <rect
        x={COUCH_VIP_X}
        y={COUCH_VIP_Y}
        width={COUCH_VIP_W}
        height={COUCH_VIP_H}
        rx="14"
        fill="#5a3f7a"
      />
      <rect
        x={COUCH_VIP_X + 6}
        y={COUCH_VIP_Y + 6}
        width={COUCH_VIP_W - 12}
        height={COUCH_VIP_H - 18}
        rx="10"
        fill="#7a5aa5"
      />

      {/* Champagne table in front of the couch. */}
      <rect x={TABLE_X} y={TABLE_Y} width={TABLE_W} height={TABLE_H} rx="4" fill="#3a2f55" />
      <rect x={TABLE_X} y={TABLE_Y - 3} width={TABLE_W} height="5" fill="#5a4a85" />

      {/* Two champagne bottles on the table. Body + neck + foil. */}
      {BOTTLES.map((b, i) => (
        <g key={`bottle-${i}`}>
          <rect x={b.x} y={b.y} width="7" height="18" rx="2" fill="#1f6b3a" />
          <rect x={b.x + 1.5} y={b.y - 6} width="4" height="6" fill="#1f6b3a" />
          <rect x={b.x + 1} y={b.y - 8} width="5" height="3" fill="#ffd166" />
        </g>
      ))}

      {/* Pop spray — small starburst path placed at each bottle neck;
          opacity-keyframed so the pops fire as Higman is seated. */}
      {BOTTLES.map((b, i) => (
        <g
          key={`pop-${i}`}
          className="eos-splash__champagne-pop"
          style={{
            '--i': i,
            '--pop-origin-x': `${b.x + 3.5}px`,
            '--pop-origin-y': `${b.y - 8}px`,
          }}
        >
          <path
            d={`M ${b.x + 3.5} ${b.y - 8}
                m -8 -2 l 4 -3
                m 0 5 l 5 -6
                m 4 1 l 2 -7
                m 5 5 l 7 -3
                m -3 6 l 8 1`}
            stroke="#ffe89a"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={b.x + 3.5} cy={b.y - 8} r="2" fill="#ffd166" />
        </g>
      ))}

      {/* Three VIP dots seated either side of Higman. Each dot is
          rendered with a long-flowing-hair silhouette behind the face
          circle: the hair path crests over the top of the head, hangs
          down BELOW the dot on both sides like flowing locks, and
          carries a small white hair-bow accent on top so the
          femininity reads at every breakpoint (top-down 2D circles
          can't show eyelashes / lipstick legibly, so the silhouette
          + accessory is doing all the work). Pink / magenta / purple
          fills make them obvious from across the dance floor. */}
      {VIPS.map((v, i) => (
        <g
          key={`vip-${i}`}
          className="eos-splash__vip-dot"
          style={{
            '--i': i,
            '--bob-dx': '1px',
            '--bob-dy': '2px',
          }}
        >
          {/* Long flowing hair — single closed path that wraps the
              top of the head AND extends down past the dot on both
              sides. The face circle (drawn next) covers the middle,
              leaving long strands visible above, beside, and below
              the head. */}
          <path
            d={`M ${v.x - VIP_R - 5} ${v.y + 16}
                C ${v.x - VIP_R - 9} ${v.y - 4},
                  ${v.x - VIP_R - 4} ${v.y - VIP_R - 9},
                  ${v.x} ${v.y - VIP_R - 9}
                C ${v.x + VIP_R + 4} ${v.y - VIP_R - 9},
                  ${v.x + VIP_R + 9} ${v.y - 4},
                  ${v.x + VIP_R + 5} ${v.y + 16}
                L ${v.x + VIP_R + 1} ${v.y + 20}
                L ${v.x - VIP_R - 1} ${v.y + 20}
                Z`}
            fill={v.hair}
            opacity="0.95"
          />
          {/* Tiny hair-bow accent on top of the head — two small
              triangular leaves with a knot circle in the middle. The
              white-on-magenta contrast pops at every breakpoint. */}
          <g transform={`translate(${v.x} ${v.y - VIP_R - 7})`}>
            <path d="M -4 0 L -1 -2 L -1 2 Z" fill="#ffffff" />
            <path d="M 4 0 L 1 -2 L 1 2 Z" fill="#ffffff" />
            <circle cx="0" cy="0" r="1.4" fill="#ffffff" />
          </g>
          <circle cx={v.x} cy={v.y} r={VIP_R} fill={v.fill} stroke="#0a0a0a" strokeOpacity="0.4" strokeWidth="1" />
          <circle cx={v.x} cy={v.y - VIP_R * 0.4} r={VIP_R * 0.5} fill="#ffffff" opacity="0.18" />
        </g>
      ))}

      {/* Arteta — a fourth, RED dot already seated in the VIP at the
          entrance end of the couch, so he's the first person Higman
          meets when he crosses the rope. Same visual family as
          Higman's own dot (red gradient + white highlight) but no
          gold ring or crown — only the reigning TCLOT champion gets
          those embellishments. The "Arteta" surname label uses the
          standard label typography so it reads as a peer dot rather
          than a featured dot. */}
      <g>
        <circle
          cx={ARTETA_X}
          cy={ARTETA_Y}
          r={ARTETA_R}
          fill="#dc2828"
          stroke="#0a0a0a"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        <circle
          cx={ARTETA_X}
          cy={ARTETA_Y - ARTETA_R * 0.4}
          r={ARTETA_R * 0.5}
          fill="#ffffff"
          opacity="0.18"
        />
        <text
          x={ARTETA_X}
          y={ARTETA_Y + ARTETA_R + 14}
          textAnchor="middle"
          className="eos-splash__label"
        >
          Arteta
        </text>
      </g>

      {/* Handshake glyph — fires for ~1.5s while Higman pauses at his
          W5 waypoint (cinematic seconds 21.5–23). Two short converging
          arm strokes from each dot's edge meet at a small gold circle
          + spark burst at the midpoint, with the whole group
          opacity/scale-keyframed by `eos-handshake-pop`. The
          `--shake-x/--shake-y` CSS vars pin the scale wobble's
          transform-origin to the handshake midpoint so the bounce
          centres between the two dots. */}
      <g
        className="eos-splash__handshake"
        style={{
          '--shake-x': `${HANDSHAKE_X}px`,
          '--shake-y': `${HANDSHAKE_Y}px`,
        }}
      >
        <line
          x1={ARTETA_X + ARTETA_R - 1}
          y1={ARTETA_Y - 1}
          x2={HANDSHAKE_X - 1}
          y2={HANDSHAKE_Y - 1}
          stroke="#ffe8c0"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <line
          x1={CLUB_HIGMAN_W5_X - HIGMAN_R + 1}
          y1={CLUB_HIGMAN_W5_Y - 1}
          x2={HANDSHAKE_X + 1}
          y2={HANDSHAKE_Y - 1}
          stroke="#ffe8c0"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx={HANDSHAKE_X} cy={HANDSHAKE_Y - 1} r="3" fill="#ffd166" />
        {/* Four short spark lines radiating from the midpoint for
            comic-book "hands meeting" emphasis. */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i * 90 + 45) * (Math.PI / 180);
          const r1 = 5;
          const r2 = 9;
          return (
            <line
              key={`spark-${i}`}
              x1={HANDSHAKE_X + Math.cos(angle) * r1}
              y1={HANDSHAKE_Y - 1 + Math.sin(angle) * r1}
              x2={HANDSHAKE_X + Math.cos(angle) * r2}
              y2={HANDSHAKE_Y - 1 + Math.sin(angle) * r2}
              stroke="#ffd166"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Velvet rope across the open side of the VIP — two posts + a
          gentle catenary cubic, gold-rope coloured. The opening is on
          the bottom-left of the enclosure (Higman walks in through it). */}
      <circle cx={VIP_ROPE_X1} cy={VIP_ROPE_Y1} r="4" fill="#ffd166" />
      <circle cx={VIP_ROPE_X2} cy={VIP_ROPE_Y2} r="4" fill="#ffd166" />
      <line x1={VIP_ROPE_X1} y1={VIP_ROPE_Y1} x2={VIP_ROPE_X1} y2={VIP_ROPE_Y1 + 28} stroke="#3a2f55" strokeWidth="3" />
      <line x1={VIP_ROPE_X2} y1={VIP_ROPE_Y2} x2={VIP_ROPE_X2} y2={VIP_ROPE_Y2 + 28} stroke="#3a2f55" strokeWidth="3" />
      <path
        d={`M ${VIP_ROPE_X1} ${VIP_ROPE_Y1}
            C ${VIP_ROPE_X1 + 30} ${VIP_ROPE_Y1 + 16},
              ${VIP_ROPE_X2 - 30} ${VIP_ROPE_Y2 + 16},
              ${VIP_ROPE_X2} ${VIP_ROPE_Y2}`}
        stroke="#c9962a"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* SCENE 3 — Bathroom puzzle.
 *
 * Top-down 2D bathroom (1024×576 viewBox):
 *   - Walled room: thick rounded rect with `eos-bath-floor` fill and
 *     `eos-bath-wall` stroke, a door cutout at the top-centre with a
 *     small handle dot
 *   - Sink against the LEFT wall: small counter (vanity) + inset
 *     basin + a tap mounted at the back-left of the basin + a tiny
 *     drain dot in the basin centre. Smaller than the original bath
 *     fixture so the room reads as a cramped "toilet + sink only"
 *     bathroom — the "couldn't find space" punchline lands harder.
 *   - Toilet on the RIGHT wall: rectangular base + ellipse seat + tank
 *   - Faint floor-tile cross-hatch so the floor reads as tiled
 *   - Puzzle frame: a stroked rect 8×6 grid centred above where Tery
 *     sits down. 48 real jigsaw-shape pieces are rendered at their
 *     FINAL slot positions and translate IN from per-piece scatter
 *     offsets via `eos-puzzle-snap`, staggered 0.28s apart by `--i`.
 *     Pieces are proper jigsaw cutouts (interlocking tab / blank /
 *     flat edges per the deterministic `PIECE_EDGES_GRID`), and the
 *     scatter pattern is a Vogel sunflower spiral centred on Tery.
 *
 *     Importantly, the scene now fades OUT before the puzzle is
 *     finished: only the first ~24 pieces (≈half) reach their snap
 *     delay before the scene fade kicks in at t≈41s, and pieces
 *     24–47 stay at their scatter positions throughout. The
 *     backwards-fill of `eos-puzzle-snap`'s 0% keyframe carries the
 *     scattered pieces visibly during the entire scene window so the
 *     "half-done puzzle, pieces strewn around Tery" tableau lands
 *     just as the scene fades to nothing.
 *   - Tery: Mii-style avatar (head + body) — enters from the door
 *     and walks to a seated position in front of the puzzle. `Tery`
 *     surname label sits just below his avatar.
 *   - Framed poster on the wall above the sink — visual atmosphere
 *     painted in via a JPEG `<image>` element.                          */
/* ------------------------------------------------------------------ */
function BathroomScene() {
  return (
    <g className="eos-splash__scene eos-splash__scene--bathroom">
      {/* Floor + walls. Rendered as a single rounded rect with a
          thick outer stroke — the stroke reads as the wall, the fill
          reads as the floor. */}
      <rect
        x={ROOM_X}
        y={ROOM_Y}
        width={ROOM_W}
        height={ROOM_H}
        rx="12"
        fill="url(#eos-bath-floor)"
        stroke="url(#eos-bath-wall)"
        strokeWidth="14"
      />

      {/* Door cutout at the top of the room — a lighter-coloured rect
          cut into the top wall + a small handle dot on the right side
          of the door. */}
      <rect
        x={DOOR_X}
        y={DOOR_Y}
        width={DOOR_W}
        height={DOOR_H}
        fill="#5a4a85"
        stroke="#3a2f55"
        strokeWidth="2"
      />
      <circle cx={DOOR_X + DOOR_W - 8} cy={DOOR_Y + DOOR_H / 2} r="2" fill="#ffd166" />

      {/* Faint tile grid on the floor — 8×6 cross-hatch. */}
      <g stroke="#3a3550" strokeOpacity="0.35" strokeWidth="0.8">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line
            key={`tile-v-${i}`}
            x1={ROOM_X + (ROOM_W * i) / 8}
            y1={ROOM_Y + 8}
            x2={ROOM_X + (ROOM_W * i) / 8}
            y2={ROOM_Y + ROOM_H - 8}
          />
        ))}
        {[1, 2, 3, 4, 5].map((i) => (
          <line
            key={`tile-h-${i}`}
            x1={ROOM_X + 8}
            y1={ROOM_Y + (ROOM_H * i) / 6}
            x2={ROOM_X + ROOM_W - 8}
            y2={ROOM_Y + (ROOM_H * i) / 6}
          />
        ))}
      </g>

      {/* Sink against the LEFT wall — counter + inset basin + tap +
          drain. Replaces the older bath fixture so the room reads as
          a small "toilet + sink only" bathroom; the tighter footprint
          makes the "couldn't find space" punchline land harder. */}
      <g>
        {/* Counter (vanity) — pale, lightly stroked. */}
        <rect
          x={SINK_COUNTER_X}
          y={SINK_COUNTER_Y}
          width={SINK_COUNTER_W}
          height={SINK_COUNTER_H}
          rx="6"
          fill="#d8d6e6"
          stroke="#a8a4c0"
          strokeWidth="2"
        />
        {/* Basin — inset rounded rect with a dark interior so the
            drain dot reads. */}
        <rect
          x={SINK_BASIN_X}
          y={SINK_BASIN_Y}
          width={SINK_BASIN_W}
          height={SINK_BASIN_H}
          rx="5"
          fill="#22203a"
          stroke="#5a5070"
          strokeWidth="1"
        />
        {/* Tap mounted at the BACK-LEFT of the basin (wall side).
            Body sits in the counter inset gap; a small spout extends
            over the basin from there. */}
        <rect
          x={SINK_TAP_X}
          y={SINK_TAP_Y}
          width={SINK_TAP_W}
          height={SINK_TAP_H}
          rx="1.5"
          fill="#9ea0c4"
        />
        <rect
          x={SINK_TAP_X + SINK_TAP_W}
          y={SINK_TAP_Y + 2}
          width="8"
          height="4"
          fill="#9ea0c4"
        />
        {/* Drain — small recessed dot at the basin centre. */}
        <circle
          cx={SINK_BASIN_X + SINK_BASIN_W / 2}
          cy={SINK_BASIN_Y + SINK_BASIN_H / 2}
          r="2.5"
          fill="#0e0a1c"
          stroke="#9ea0c4"
          strokeWidth="1"
        />
      </g>

      {/* Toilet on the RIGHT wall — tank + base + seat. */}
      <g>
        <rect x={TOILET_TANK_X} y={TOILET_TANK_Y} width={TOILET_TANK_W} height={TOILET_TANK_H} rx="3" fill="#d8d6e6" />
        <rect x={TOILET_BASE_X} y={TOILET_BASE_Y} width={TOILET_BASE_W} height={TOILET_BASE_H} rx="3" fill="#e8e6f2" />
        <ellipse
          cx={TOILET_BASE_X + TOILET_BASE_W / 2}
          cy={TOILET_BASE_Y}
          rx={TOILET_BASE_W / 2 + 4}
          ry="10"
          fill="#c8c5dc"
          stroke="#9794ad"
          strokeWidth="1"
        />
      </g>

      {/* Small framed poster on the wall above the sink — gold-brass
          frame outside, thin dark inset, then the user-supplied image
          rendered with `xMidYMid slice` so the player photo fills the
          poster aperture without distortion at any breakpoint. The
          placement is in the empty wall area between the room top and
          the sink top, well clear of the puzzle frame and outside the
          arc that the scattered puzzle pieces sweep through during
          the snap-in animation. */}
      <g className="eos-splash__bath-poster">
        <rect
          x={POSTER_X - 4}
          y={POSTER_Y - 4}
          width={POSTER_W + 8}
          height={POSTER_H + 8}
          fill="#c8a55a"
          rx="2"
        />
        <rect
          x={POSTER_X - 1}
          y={POSTER_Y - 1}
          width={POSTER_W + 2}
          height={POSTER_H + 2}
          fill="#1a1426"
        />
        <image
          href="/brand/tery-poster.png"
          x={POSTER_X}
          y={POSTER_Y}
          width={POSTER_W}
          height={POSTER_H}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>

      {/* Puzzle frame — outer stroked rect + internal slot grid drawn
          faintly so the empty grid is visible behind any unplaced
          pieces during the snap-in cinematic. The divider arrays are
          derived from `PUZZLE_COLS` / `PUZZLE_ROWS` so the grid
          automatically tracks the constants. */}
      <g className="eos-splash__puzzle-frame">
        <rect
          x={PUZZLE_X}
          y={PUZZLE_Y}
          width={PUZZLE_W}
          height={PUZZLE_H}
          fill="#1a1426"
          stroke="#a89adb"
          strokeWidth="2"
        />
        {Array.from({ length: PUZZLE_COLS - 1 }, (_, i) => i + 1).map((i) => (
          <line
            key={`puz-v-${i}`}
            x1={PUZZLE_X + (PUZZLE_W * i) / PUZZLE_COLS}
            y1={PUZZLE_Y}
            x2={PUZZLE_X + (PUZZLE_W * i) / PUZZLE_COLS}
            y2={PUZZLE_Y + PUZZLE_H}
            stroke="#5a5070"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}
        {Array.from({ length: PUZZLE_ROWS - 1 }, (_, i) => i + 1).map((i) => (
          <line
            key={`puz-h-${i}`}
            x1={PUZZLE_X}
            y1={PUZZLE_Y + (PUZZLE_H * i) / PUZZLE_ROWS}
            x2={PUZZLE_X + PUZZLE_W}
            y2={PUZZLE_Y + (PUZZLE_H * i) / PUZZLE_ROWS}
            stroke="#5a5070"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}
      </g>

      {/* 48 jigsaw-shape puzzle pieces — each is a single `<path>`
          drawn by `jigsawPiecePath(x, y, w, h, edges)` walking the
          piece outline clockwise from the top-left corner. Edges
          come from `PIECE_EDGES_GRID[row][col]`, deterministically
          built so adjacent pieces' shared edges interlock (a `tab`
          on one side always meets a `blank` on its neighbour) and
          border pieces stay `flat` along the puzzle frame's outside.
          The wrapper `<g>` carries the per-piece `--scatter-dx/dy`
          consumed by `eos-puzzle-snap` to translate the piece in
          from its Vogel-spiral scatter point around Tery. */}
      {Array.from({ length: PUZZLE_PIECE_COUNT }).map((_, i) => {
        const col = i % PUZZLE_COLS;
        const row = Math.floor(i / PUZZLE_COLS);
        const slot = puzzleSlot(i);
        const scatter = puzzleScatter(i);
        const fill = PUZZLE_PIECE_PALETTE[i % PUZZLE_PIECE_PALETTE.length];
        const edges = PIECE_EDGES_GRID[row][col];
        const d = jigsawPiecePath(
          slot.x,
          slot.y,
          PUZZLE_PIECE_W,
          PUZZLE_PIECE_H,
          edges,
        );
        return (
          <g
            key={`puzzle-piece-${i}`}
            className="eos-splash__puzzle-piece"
            style={{
              '--i': i,
              '--scatter-dx': `${scatter.x - slot.x}px`,
              '--scatter-dy': `${scatter.y - slot.y}px`,
            }}
          >
            <path d={d} fill={fill} stroke="#1a1426" strokeWidth="0.8" />
          </g>
        );
      })}

      {/* Tery — Mii-style avatar (head + body), walks in from above
          the door, settles in front of the puzzle. Distinguishing him
          with his real avatar (rather than a generic black dot like
          the GoH security guards) makes the punchline land — viewers
          immediately recognise WHO is being sentenced to puzzles in
          the bathroom. The image is rendered at his FINAL position,
          and the outer wrapper translates the whole group through the
          door-entry → standing → seated waypoints exactly the same
          way the dot version did. Surname label is anchored on the
          OUTER wrapper so it stays put during the walk. */}
      <g
        className="eos-splash__tery"
        style={{
          '--enter-dx': `${TERY_ENTRY_X - TERY_FINAL_X}px`,
          '--enter-dy': `${TERY_ENTRY_Y - TERY_FINAL_Y}px`,
          '--stand-dx': `${TERY_STAND_X - TERY_FINAL_X}px`,
          '--stand-dy': `${TERY_STAND_Y - TERY_FINAL_Y}px`,
        }}
      >
        <image
          className="eos-splash__tery-avatar"
          href="/brand/tery-avatar.png"
          x={TERY_FINAL_X - TERY_AVATAR_W / 2}
          y={TERY_FINAL_Y - TERY_AVATAR_H / 2}
          width={TERY_AVATAR_W}
          height={TERY_AVATAR_H}
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          x={TERY_FINAL_X}
          y={TERY_FINAL_Y + TERY_AVATAR_H / 2 + 14}
          textAnchor="middle"
          className="eos-splash__label eos-splash__label--tery"
        >
          {WOODEN_SPOON_MANAGER_SURNAME}
        </text>
      </g>

    </g>
  );
}

/* ------------------------------------------------------------------ */
/* INTERSTITIAL — "Meanwhile, in Brampton..."
 *
 * A short 3s text card that sits between the nightclub and bathroom
 * scenes. It plays after Higman has settled on the VIP couch (with
 * champagne popping in the rear-view) and before Tery's bathroom
 * tableau begins. The dark-card aesthetic is deliberately stark — a
 * single italicised tagline on a deep purple background — so the cut
 * to the cramped bathroom lands harder by contrast.
 *
 * Default opacity is 0 (set in the static fallback rule below) so
 * this scene is invisible outside playback, just like scenes 1, 2,
 * and the outro. The bathroom static tableau remains the default
 * "non-playing" view for prefers-reduced-motion viewers.            */
/* ------------------------------------------------------------------ */
function BramptonScene() {
  return (
    <g className="eos-splash__scene eos-splash__scene--brampton">
      <rect x="0" y="0" width="1024" height="576" fill="#100a20" />
      <text
        x="512"
        y={BRAMPTON_LINE_Y}
        textAnchor="middle"
        className="eos-splash__brampton-line"
      >
        Meanwhile, in Brampton...
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* SCENE 4 — Outro: "See ya next season!" + fantasy badges grid.
 *
 * The final tableau of the cinematic. After the bathroom dissolves on
 * its half-done puzzle, this scene fades up onto a black-purple field
 * with a celebratory headline and a 3×3 grid of all nine TCLOT
 * fantasy team badges (the manager team-logos shipped under
 * `/team-logos-web/`). Each badge pops in via a per-tile staggered
 * keyframe so the grid populates from top-left to bottom-right
 * rather than appearing all at once.                                  */
/* ------------------------------------------------------------------ */
function OutroScene() {
  return (
    <g className="eos-splash__scene eos-splash__scene--outro">
      <rect x="0" y="0" width="1024" height="576" fill="#080612" />

      <text
        x="512"
        y={OUTRO_TITLE_Y}
        textAnchor="middle"
        className="eos-splash__outro-title"
      >
        See ya next season!
      </text>

      {OUTRO_BADGES.map((id, i) => {
        const col = i % OUTRO_GRID_COLS;
        const row = Math.floor(i / OUTRO_GRID_COLS);
        const cx =
          OUTRO_GRID_X +
          col * (OUTRO_BADGE_DIAMETER + OUTRO_BADGE_GAP) +
          OUTRO_BADGE_DIAMETER / 2;
        const cy =
          OUTRO_GRID_Y +
          row * (OUTRO_BADGE_DIAMETER + OUTRO_BADGE_GAP) +
          OUTRO_BADGE_DIAMETER / 2;
        const r = OUTRO_BADGE_DIAMETER / 2;
        const clipId = `eos-outro-badge-clip-${i}`;
        return (
          <g
            key={`outro-badge-${id}`}
            className="eos-splash__outro-badge"
            style={{ '--i': i }}
          >
            <defs>
              <clipPath id={clipId}>
                <circle cx={cx} cy={cy} r={r} />
              </clipPath>
            </defs>
            {/* Subtle inner shadow disc behind the image — same dark
                neutral the on-site .team-avatar-frame uses
                (background: #2a2a2a) so transparent or letterboxed
                logos read consistently against the deep-purple outro
                field. */}
            <circle cx={cx} cy={cy} r={r} fill="#2a2a2a" />
            <image
              href={`/team-logos-web/${id}.png`}
              x={cx - r}
              y={cy - r}
              width={r * 2}
              height={r * 2}
              clipPath={`url(#${clipId})`}
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Thin light ring on top — mirrors the
                `.team-avatar-frame { border: 1px solid rgba(255, 255,
                255, 0.1); }` rule used on every TeamAvatar across the
                site, so the outro tiles read as the SAME circular
                badge family rather than a bespoke alternate style. */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="rgba(255, 255, 255, 0.18)"
              strokeWidth="2"
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Small crown glyph rendered inside Higman's dot. Same shape used by
 * the Guard of Honour splash — a 5-point coronet with a rounded base.
 * Kept colocated rather than imported so the End-of-Season component
 * file is fully self-contained.
 */
function CrownGlyph({ cx, cy, scale }) {
  const d = `
    M -28 8
    L -28 -8
    L -16 4
    L -8 -16
    L 0 6
    L 8 -16
    L 16 4
    L 28 -8
    L 28 8
    Z
    M -30 10
    L 30 10
    L 30 16
    L -30 16
    Z
  `;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <path d={d} fill="#ffffff" />
    </g>
  );
}

/* ================================================================== */
/* LAYOUT CONSTANTS — single source of truth for the cinematic geometry.
 *
 * All values are in 1024×576 viewBox units. Grouped by scene; constants
 * referenced in CSS keyframe waypoints (`--enter-dx`, `--w1-dx`, etc.)
 * are computed at JSX render time as `(waypoint − final)` offsets so
 * the animation simply translates each element from its waypoint back
 * to its FINAL render position (the SVG-rendered position).            */
/* ================================================================== */

/* SCENE 1 — Title --------------------------------------------------- */

/**
 * Brand banner area — wide enough to give the lion + wordmark + flag
 * row room to breathe at desktop sizes, but `preserveAspectRatio` on
 * the `<image>` keeps the JPEG undistorted at every breakpoint. The
 * three tagline lines stack underneath, leaving the bottom 70px or so
 * for breathing room above the bottom edge of the splash.
 */
const TITLE_BANNER_X = 162;
const TITLE_BANNER_Y = 60;
const TITLE_BANNER_W = 700;
const TITLE_BANNER_H = 300;
const TITLE_LINE_EYEBROW_Y = 410;
const TITLE_LINE_HEADLINE_Y = 460;
const TITLE_LINE_SUB_Y = 505;

/* SCENE 2 — Nightclub ---------------------------------------------- */

/** Dance floor — dark rounded rect, centre stage. Sized so it leaves
 * room for the bar at the top, the atmosphere couch on the left, and
 * the VIP enclosure on the right. */
const FLOOR_X = 220;
const FLOOR_Y = 200;
const FLOOR_W = 460;
const FLOOR_H = 240;

/** Bar against the LEFT wall — vertical orientation in top-down view.
 * Sits ABOVE the atmosphere couch (which still anchors the lower-left
 * corner of the club). The customer side of the counter is the right
 * edge (closest to the dance floor at FLOOR_X=220), so Higman's W0
 * customer stop is positioned at `BAR_X + BAR_W + ~16px`. The bottle
 * shelf is the narrow strip along the back (left) edge against the
 * wall. */
const BAR_X = 70;
const BAR_Y = 130;
const BAR_W = 90;
const BAR_H = 184;

/** Barman dot — stands behind the counter on the staff side, level
 * with Higman's W0 customer stop so the two are eye-to-eye across the
 * counter. */
const BARMAN_X = 100;
const BARMAN_Y = 215;
const BARMAN_R = 10;

/** Atmosphere couch on the LEFT — just dressing, never sat on. Sits
 * directly below the bar fixture. */
const COUCH_LEFT_X = 70;
const COUCH_LEFT_Y = 330;
const COUCH_LEFT_W = 130;
const COUCH_LEFT_H = 60;

/** Disco ball + light cones. The ball pivot is a single (x, y) — the
 * inner spin group rotates around (0, 0) so its `transform-origin`
 * stays at the wrapper translate point. */
const DISCO_BALL_X = 460;
const DISCO_BALL_Y = 100;
const DISCO_BALL_R = 18;

/** Six disco-light cones converging onto the dance floor. Each cone is
 * a triangle: `a` (anchor point in the ceiling area) + `l` (left base
 * point on the floor) + `r` (right base point on the floor). Six cones
 * total — three from the left ceiling and three from the right —
 * cycling colour and opacity via `eos-disco-cycle`. */
const DISCO_BEAMS = [
  { ax: 270, ay: 80, lx: 240, ly: 410, rx: 320, ry: 410 },
  { ax: 320, ay: 80, lx: 320, ly: 410, rx: 400, ry: 410 },
  { ax: 380, ay: 80, lx: 360, ly: 410, rx: 440, ry: 410 },
  { ax: 540, ay: 80, lx: 480, ly: 410, rx: 560, ry: 410 },
  { ax: 600, ay: 80, lx: 540, ly: 410, rx: 620, ry: 410 },
  { ax: 650, ay: 80, lx: 600, ly: 410, rx: 660, ry: 410 },
];

/** Six dancing dots scattered across the floor. `bobDx`/`bobDy` are
 * the per-dot translate amplitudes consumed by `eos-dancer-bob`. */
const DANCER_R = 11;
const DANCERS = [
  { x: 290, y: 320, fill: '#7ad6d6', bobDx: 3, bobDy: 4 },
  { x: 350, y: 360, fill: '#ffb066', bobDx: -3, bobDy: 5 },
  { x: 410, y: 300, fill: '#a3e878', bobDx: 4, bobDy: 4 },
  { x: 480, y: 380, fill: '#d68aff', bobDx: -2, bobDy: 6 },
  { x: 540, y: 340, fill: '#ffd166', bobDx: 3, bobDy: 4 },
  { x: 610, y: 310, fill: '#ff7a96', bobDx: -3, bobDy: 5 },
];

/** VIP enclosure — couch + table + 3 long-haired dots + 2 bottles, all
 * tucked into the top-right of the floor. */
const COUCH_VIP_X = 740;
const COUCH_VIP_Y = 240;
const COUCH_VIP_W = 240;
const COUCH_VIP_H = 96;
const TABLE_X = 760;
const TABLE_Y = 354;
const TABLE_W = 88;
const TABLE_H = 22;
const VIP_LABEL_X = 740;
const VIP_LABEL_Y = 200;

/** Three female VIP dots seated either side of Higman on the couch.
 * Distinguished from the unisex floor dancers by long flowing hair
 * (extends below the dot via a single closed path) plus a small white
 * hair-bow accent on top. Pink / magenta / purple fills make them
 * read clearly against the deep-purple couch backing.
 *
 * Spacing: female 1 sits to Higman's LEFT (between him and Arteta),
 * females 2 and 3 sit to his RIGHT — so Higman ends up surrounded by
 * the female dots once he settles into his seat. */
const VIP_R = 12;
const VIPS = [
  { x: 815, y: 285, fill: '#ff66cc', hair: '#c437a8' },
  { x: 920, y: 285, fill: '#c477ff', hair: '#7a35c9' },
  { x: 960, y: 285, fill: '#ff8ad6', hair: '#d04ba0' },
];

/** Arteta — fourth, RED VIP dot already seated at the entrance end of
 * the couch (closest to the rope opening). He's the first person
 * Higman shakes hands with on his way in. Coordinates picked so the
 * handshake midpoint between Arteta and Higman's W5 waypoint sits in
 * the gap between Arteta and the first female VIP. */
const ARTETA_X = 760;
const ARTETA_Y = 295;
const ARTETA_R = 13;

/** Handshake glyph midpoint — between Arteta and Higman's W5
 * waypoint, vertically aligned with their dot centres. Consumed as
 * `--shake-x`/`--shake-y` so the scale-bounce keyframe pivots here. */
const HANDSHAKE_X = (ARTETA_X + 790) / 2;
const HANDSHAKE_Y = ARTETA_Y;

/** Champagne bottles on the table — body x/y is the top-left of the
 * bottle body rect; the neck + foil are placed above. */
const BOTTLES = [
  { x: 778, y: 340 },
  { x: 818, y: 340 },
];

/** Velvet rope across the open bottom-left side of the VIP enclosure
 * — runs from the front-left post (lower-left corner of the VIP
 * rectangle) up to the post mounted on the rope side. */
const VIP_ROPE_X1 = 740;
const VIP_ROPE_Y1 = 360;
const VIP_ROPE_X2 = 760;
const VIP_ROPE_Y2 = 400;

/** Higman in the nightclub — final SVG render position is on the VIP
 * couch BETWEEN the first and second female dots, so the three VIP
 * dots end up flanking him on either side. SEVEN waypoints carry him
 * from off-screen left through the bar (W0, where he pauses for the
 * speech bubble), into the dance floor, and across to the rope; W5
 * is the handshake-pause position next to Arteta, where he holds for
 * ~1.1s while the handshake glyph fades in/out, before continuing on
 * to his seat. */
const HIGMAN_R = 14;
const CLUB_HIGMAN_FINAL_X = 870;
const CLUB_HIGMAN_FINAL_Y = 295;
const CLUB_HIGMAN_ENTRY_X = -60;
const CLUB_HIGMAN_ENTRY_Y = 320;
/** W0 — at the bar, customer side of the counter, eye-to-eye with the
 * barman. Held for ~1.9s while the speech bubble pops in. */
const CLUB_HIGMAN_W0_X = BAR_X + BAR_W + 16;
const CLUB_HIGMAN_W0_Y = BARMAN_Y;
const CLUB_HIGMAN_W1_X = 320;
const CLUB_HIGMAN_W1_Y = 320;
const CLUB_HIGMAN_W2_X = 420;
const CLUB_HIGMAN_W2_Y = 380;
const CLUB_HIGMAN_W3_X = 540;
const CLUB_HIGMAN_W3_Y = 320;
const CLUB_HIGMAN_W4_X = 660;
const CLUB_HIGMAN_W4_Y = 360;
const CLUB_HIGMAN_W5_X = 790;
const CLUB_HIGMAN_W5_Y = 295;

/** Speech bubble — rendered in wrapper-local coords offset from
 * Higman's FINAL position, so when his keyframe translates him to W0
 * the bubble is carried with him and its visible position lands above
 * and to the right of him at the bar.
 *
 * Visible position when Higman is at W0:
 *   x = SPEECH_BUBBLE_X + (W0_X - FINAL_X)
 *   y = SPEECH_BUBBLE_Y + (W0_Y - FINAL_Y)
 *
 * Tuned so the bubble lands at roughly (200, 110)–(520, 170) on screen
 * when Higman is at W0 (~(176, 215)), with a tail pointing down-left
 * to his head. The bubble's own opacity keyframe gates visibility to
 * the W0 pause window only. */
const SPEECH_BUBBLE_W = 320;
const SPEECH_BUBBLE_H = 60;
const SPEECH_BUBBLE_X = CLUB_HIGMAN_FINAL_X + (200 - CLUB_HIGMAN_W0_X);
const SPEECH_BUBBLE_Y = CLUB_HIGMAN_FINAL_Y + (110 - CLUB_HIGMAN_W0_Y);

/* SCENE 3 — Bathroom ----------------------------------------------- */

/** Walled bathroom — an inset rounded rect with a thick wall stroke
 * and a tiled-floor fill. Sized to leave a strip below for the
 * captions. */
const ROOM_X = 120;
const ROOM_Y = 60;
const ROOM_W = 784;
const ROOM_H = 440;

/** Door cutout in the top wall, slightly off-centre so the bath/toilet
 * symmetry isn't perfectly mirrored. */
const DOOR_X = 470;
const DOOR_Y = 54;
const DOOR_W = 96;
const DOOR_H = 14;

/** Sink against the LEFT wall — counter (vanity) + inset basin + tap
 * mounted at the back-left of the basin + a drain dot in the basin
 * centre. Replaces the older bath fixture so the room reads as a
 * cramped "toilet + sink only" bathroom; the tighter footprint makes
 * the "couldn't find space" punchline land harder. The basin is inset
 * 12 px from each side of the counter, so basin dimensions derive
 * from the counter rect (counter ≈ 100×80, basin ≈ 76×56). */
const SINK_COUNTER_X = 150;
const SINK_COUNTER_Y = 240;
const SINK_COUNTER_W = 100;
const SINK_COUNTER_H = 80;
const SINK_BASIN_X = SINK_COUNTER_X + 12;
const SINK_BASIN_Y = SINK_COUNTER_Y + 12;
const SINK_BASIN_W = SINK_COUNTER_W - 24;
const SINK_BASIN_H = SINK_COUNTER_H - 24;
/** Tap body sits in the counter inset gap on the wall side of the
 * basin (left edge); a small spout extends out over the basin. */
const SINK_TAP_X = 152;
const SINK_TAP_Y = 274;
const SINK_TAP_W = 12;
const SINK_TAP_H = 12;

/** Toilet against the RIGHT wall — base + tank above. */
const TOILET_TANK_X = 770;
const TOILET_TANK_Y = 220;
const TOILET_TANK_W = 70;
const TOILET_TANK_H = 50;
const TOILET_BASE_X = 778;
const TOILET_BASE_Y = 290;
const TOILET_BASE_W = 54;
const TOILET_BASE_H = 80;

/** Framed poster on the wall above the sink. Placed in the upper-left
 * empty zone (between ROOM_Y and SINK_COUNTER_Y) so it sits in a
 * natural "wall art" position without crashing into the puzzle frame.
 * The Vogel-spiral scatter (centred slightly above Tery) keeps every
 * piece's starting position safely to the right of the poster column
 * so pieces don't fly across the picture during the snap-in. */
const POSTER_X = 198;
const POSTER_Y = 100;
const POSTER_W = 78;
const POSTER_H = 96;

/** Puzzle frame — 8×6 slot grid centred horizontally above where Tery
 * sits. Slot dimensions derive from the frame and the row/col counts:
 * with the bumped grid each piece is roughly 35×30 viewBox units
 * before its tabs (vs. the original 70×60 single-rect tiles). Frame
 * dimensions are unchanged from the v1 grid so the visible puzzle
 * occupies the same on-screen rectangle. */
const PUZZLE_COLS = 8;
const PUZZLE_ROWS = 6;
const PUZZLE_PIECE_COUNT = PUZZLE_COLS * PUZZLE_ROWS;
const PUZZLE_X = 372;
const PUZZLE_Y = 180;
const PUZZLE_W = 280;
const PUZZLE_H = 180;
const PUZZLE_PIECE_W = PUZZLE_W / PUZZLE_COLS;
const PUZZLE_PIECE_H = PUZZLE_H / PUZZLE_ROWS;

/** Multi-tone palette so the assembled 48-piece puzzle reads as an
 * actual picture rather than a uniform mosaic. Colours cycle by
 * piece index — extended from 12 → 16 entries so the larger grid
 * gets noticeably more variation across the surface. */
const PUZZLE_PIECE_PALETTE = [
  '#5a85d6',
  '#d68a5a',
  '#5ad6a3',
  '#d65a85',
  '#a3d65a',
  '#a35ad6',
  '#d6c45a',
  '#5ad6c4',
  '#d65aa3',
  '#5aa3d6',
  '#d6855a',
  '#85d65a',
  '#6b5ad6',
  '#d65a5a',
  '#5ad67a',
  '#d6a35a',
];

/** Final slot position (top-left corner) for puzzle piece `i`. */
function puzzleSlot(i) {
  const col = i % PUZZLE_COLS;
  const row = Math.floor(i / PUZZLE_COLS);
  return {
    x: PUZZLE_X + col * PUZZLE_PIECE_W,
    y: PUZZLE_Y + row * PUZZLE_PIECE_H,
  };
}

/**
 * Scattered start position for puzzle piece `i`. Pieces fan out around
 * TERY in a Vogel "sunflower" spiral — `angle = i × goldenAngle`,
 * `radius = 70 + √i × 16` — giving an organic-looking spread rather
 * than the previous evenly-spaced ring. The y component is squished
 * to 0.5 of the x component (and the scatter centre is offset 40 px
 * above Tery) so the spread fits inside the room without extending
 * past the bottom wall.
 *
 * Pieces sitting on top of the puzzle frame at scatter time is fine —
 * they're in transit and the snap-in animation translates each piece
 * back to its slot.
 */
function puzzleScatter(i) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = i * goldenAngle;
  const distance = 70 + Math.sqrt(i) * 16;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance * 0.5;
  return {
    x: TERY_FINAL_X + dx - PUZZLE_PIECE_W / 2,
    y: TERY_FINAL_Y - 40 + dy - PUZZLE_PIECE_H / 2,
  };
}

/* ------------------------------------------------------------------ */
/* Jigsaw piece geometry — single-path tab/blank/flat edge renderer +
 * deterministic edge grid so adjacent pieces interlock.              */
/* ------------------------------------------------------------------ */

/**
 * Pseudo-random in `[0, 1)` derived deterministically from a `(row,
 * col)` pair via the classic `sin(x) * large constant fract` trick.
 * Used to assign tab / blank to a shared edge before its neighbour
 * derives the opposite. The offset arg lets us seed the right edge
 * differently from the bottom edge for the same `(row, col)` without
 * collisions.
 */
function seededRandom(row, col, offset = 0) {
  const v = Math.sin(row * 12.9898 + col * 78.233 + offset) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Build the full `PUZZLE_ROWS × PUZZLE_COLS` edge grid in one pass.
 * Each piece's `top` is the inverse of the piece-above's `bottom`,
 * and each piece's `left` is the inverse of the piece-left's `right`;
 * border edges that touch the puzzle frame's outside are `flat`.
 * Bottom + right edges of interior pieces are randomised via
 * `seededRandom`. Computed once at module load — `PIECE_EDGES_GRID`
 * is then a constant lookup.
 */
function buildPieceEdgesGrid() {
  const grid = [];
  for (let row = 0; row < PUZZLE_ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < PUZZLE_COLS; col++) {
      const top =
        row === 0 ? 'flat' : (grid[row - 1][col].bottom === 'tab' ? 'blank' : 'tab');
      const left =
        col === 0 ? 'flat' : (grid[row][col - 1].right === 'tab' ? 'blank' : 'tab');
      const bottom =
        row === PUZZLE_ROWS - 1
          ? 'flat'
          : seededRandom(row, col, 0) < 0.5
            ? 'tab'
            : 'blank';
      const right =
        col === PUZZLE_COLS - 1
          ? 'flat'
          : seededRandom(row, col, 1000) < 0.5
            ? 'tab'
            : 'blank';
      grid[row][col] = { top, right, bottom, left };
    }
  }
  return grid;
}

const PIECE_EDGES_GRID = buildPieceEdgesGrid();

/**
 * Render one jigsaw piece as a single closed SVG path, walking the
 * outline clockwise from the top-left corner `(x, y)`. Each of the
 * four edges is either `flat` (straight line), `tab` (outward
 * half-circle-ish bump via cubic bezier), or `blank` (inward bump).
 * The bump is centred on the edge midpoint, base width ≈ 1/3 of the
 * edge length, depth ≈ 25% of `min(w, h)`.
 */
function jigsawPiecePath(x, y, w, h, edges) {
  const bump = Math.min(w, h) * 0.25;
  let d = `M ${x} ${y}`;
  d += jigsawEdgeSegment('top', x, y, w, bump, edges.top);
  d += jigsawEdgeSegment('right', x + w, y, h, bump, edges.right);
  d += jigsawEdgeSegment('bottom', x + w, y + h, w, bump, edges.bottom);
  d += jigsawEdgeSegment('left', x, y + h, h, bump, edges.left);
  d += ' Z';
  return d;
}

/**
 * Path commands for one edge of a jigsaw piece. `(sx, sy)` is the
 * start corner; the function returns the commands that continue the
 * path to the next corner, with the appropriate tab/blank bump
 * centred on the edge midpoint. For `tab`, the bump points OUTWARD
 * from the piece interior (away from the piece); for `blank`, it
 * points INWARD.
 */
function jigsawEdgeSegment(side, sx, sy, len, bump, type) {
  if (type === 'flat') {
    if (side === 'top') return ` L ${sx + len} ${sy}`;
    if (side === 'right') return ` L ${sx} ${sy + len}`;
    if (side === 'bottom') return ` L ${sx - len} ${sy}`;
    return ` L ${sx} ${sy - len}`;
  }
  const outward = type === 'tab' ? 1 : -1;
  if (side === 'top') {
    const p1x = sx + len / 3;
    const p2x = sx + (2 * len) / 3;
    const by = sy - outward * bump;
    return ` L ${p1x} ${sy} C ${p1x} ${by}, ${p2x} ${by}, ${p2x} ${sy} L ${sx + len} ${sy}`;
  }
  if (side === 'right') {
    const p1y = sy + len / 3;
    const p2y = sy + (2 * len) / 3;
    const bx = sx + outward * bump;
    return ` L ${sx} ${p1y} C ${bx} ${p1y}, ${bx} ${p2y}, ${sx} ${p2y} L ${sx} ${sy + len}`;
  }
  if (side === 'bottom') {
    const p1x = sx - len / 3;
    const p2x = sx - (2 * len) / 3;
    const by = sy + outward * bump;
    return ` L ${p1x} ${sy} C ${p1x} ${by}, ${p2x} ${by}, ${p2x} ${sy} L ${sx - len} ${sy}`;
  }
  // side === 'left'
  const p1y = sy - len / 3;
  const p2y = sy - (2 * len) / 3;
  const bx = sx - outward * bump;
  return ` L ${sx} ${p1y} C ${bx} ${p1y}, ${bx} ${p2y}, ${sx} ${p2y} L ${sx} ${sy - len}`;
}

/** Tery in the bathroom — final SVG render position is just below the
 * puzzle frame, where he sits to assemble it. Walks in from off-screen
 * above the door, pauses briefly at standing height, then settles into
 * the seated position.
 *
 * `TERY_AVATAR_W/H` describe the Mii avatar's bounding box in viewBox
 * units — sized so the head reads clearly at desktop while the
 * shoulders + body still fit in the gap between the puzzle frame
 * (bottom y ≈ 360) and the caption stack (top y ≈ 540).             */
const TERY_AVATAR_W = 56;
const TERY_AVATAR_H = 70;
const TERY_FINAL_X = 512;
const TERY_FINAL_Y = 440;
const TERY_STAND_X = 512;
const TERY_STAND_Y = 410;
const TERY_ENTRY_X = 518;
const TERY_ENTRY_Y = -40;

/* INTERSTITIAL — Brampton card --------------------------------------- */

/** Vertical centre of the "Meanwhile, in Brampton..." line. Positioned
 * slightly below the geometric centre of the 1024×576 viewBox to leave
 * a touch more breathing room above than below — easier on the eye
 * than a perfectly-centred line. */
const BRAMPTON_LINE_Y = 320;

/* SCENE 4 — Outro: "See ya next season!" + fantasy badges grid ------- */

/**
 * League-entry IDs + surname fallbacks for the eight TCLOT managers,
 * in the order their badges appear in the outro grid (left-to-right,
 * top-to-bottom). The `id` values are the same as filenames under
 * `/team-logos-web/{id}.png`, so each `<image>` href resolves to the
 * manager's custom badge artwork. The list mirrors the eight managers
 * in `web/public/league-data/details.json`.
 *
 * Not every manager has a custom badge uploaded, so each tile also
 * carries a `surname` fallback that is rendered as a text label
 * underneath where the image would sit. When the badge image is
 * present it draws over the text and the label is hidden visually;
 * when it is absent the text reads as the tile's identifier instead
 * of leaving an empty bordered frame. Adding a new badge image to
 * `web/public/team-logos/` (and re-running the build pipeline) will
 * automatically swap the surname fallback for the artwork without any
 * code change here.
 */
const OUTRO_BADGES = [
  { id: 26587, surname: 'Goodacre' },     // Hanson of York AFC
  { id: 26675, surname: 'Mottershead' },  // Hackney Meat Loaf
  { id: 27370, surname: 'Higman' },       // Crouch End Oashisu (champion)
  { id: 31076, surname: 'Butcher' },      // Seoul Club 7
  { id: 39078, surname: 'Sutton' },       // Clapton Cornershop
  { id: 39219, surname: 'Ward' },         // Morpeth Jamiroquai
  { id: 40206, surname: 'Ward' },         // Toronto Oizo
  { id: 72086, surname: 'Webster' },      // Brampton II Men
];

/** League-entry IDs that have an actual badge file under
 * `web/public/team-logos-web/`. Used to gate `<image>` rendering so
 * tiles with missing artwork don't show a broken-image icon. Update
 * this set when a new badge PNG is added under `web/public/team-logos/`
 * (the build step rasterises it into `team-logos-web/`). */
const OUTRO_BADGES_WITH_LOGO = new Set([26587, 27370, 39219]);

const OUTRO_TITLE_Y = 110;
const OUTRO_GRID_COLS = 4;
const OUTRO_BADGE_SIZE = 130;
const OUTRO_BADGE_GAP = 24;
/** Centred horizontally: 4×130 + 3×24 = 592 → (1024 − 592) / 2 = 216. */
const OUTRO_GRID_X = 216;
const OUTRO_GRID_Y = 180;
