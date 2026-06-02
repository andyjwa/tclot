import { useState } from 'react';
import { EPISODE_NUMBER, SEASON_THEME, VADER_LINES, SEASON_OPENER_MANAGERS } from './seasonOpener.js';
import './SeasonOpenerSplash.css';

const SESSION_PLAY_KEY = 'tclot:so:plays:v1';
const SESSION_PLAY_CAP = 2;

/**
 * Season Opener cinematic — four scenes (title / dark forest / Hobbiton +
 * walk to Bag End door / door reveal + Vader speech). Mounted on the FPL
 * Live → Vibes sub-tab. See SeasonOpenerSplash.css for keyframe timeline.
 *
 * @param {{ onDismiss?: () => void }} props
 */
export function SeasonOpenerSplash({ onDismiss }) {
  const [playId, setPlayId] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const n = Number(window.sessionStorage.getItem(SESSION_PLAY_KEY) ?? '0');
      if (!Number.isFinite(n) || n >= SESSION_PLAY_CAP) return 0;
      window.sessionStorage.setItem(SESSION_PLAY_KEY, String(n + 1));
      return n + 1;
    } catch { return 1; }
  });
  const isPlaying = playId > 0;
  const handleReplay = () => setPlayId((id) => id + 1);

  return (
    <div
      className={
        'so-splash' +
        (isPlaying ? ' so-splash--playing' : '') +
        (onDismiss ? '' : ' so-splash--no-dismiss')
      }
      role="region"
      aria-label="Season opener cinematic"
    >
      {onDismiss ? (
        <button type="button" className="so-splash__dismiss" onClick={onDismiss} aria-label="Dismiss">
          <span className="so-splash__dismiss-x" aria-hidden="true">×</span>
        </button>
      ) : null}
      <button type="button" className="so-splash__replay" onClick={handleReplay} aria-label="Replay">
        <span className="so-splash__replay-icon" aria-hidden="true">↻</span>
      </button>
      <svg
        key={playId}
        className="so-splash__svg"
        viewBox="0 0 1024 576"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Season opener — Episode ${EPISODE_NUMBER}: ${SEASON_THEME}`}
      >
        <defs>
          <linearGradient id="so-forest-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e2a1f" />
            <stop offset="100%" stopColor="#1a3829" />
          </linearGradient>
          <linearGradient id="so-forest-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0e6c8" stopOpacity="0" />
            <stop offset="100%" stopColor="#f0e6c8" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="so-hobbiton-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a4cfe0" />
            <stop offset="100%" stopColor="#dceaf2" />
          </linearGradient>
          <radialGradient id="so-amber-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd28a" stopOpacity="1" />
            <stop offset="55%" stopColor="#ffb24a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffb24a" stopOpacity="0" />
          </radialGradient>
          <path
            id="so-ring-inscription-path"
            d="M 448 300 A 64 64 0 1 1 576 300 A 64 64 0 1 1 448 300"
            fill="none"
          />
        </defs>
        <rect width="1024" height="576" fill="#0e0a1c" />
        <TitleScene />
        <DarkForestScene />
        <HobbitonScene />
        <DoorRevealScene />
        <VaderScene />
      </svg>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 1 — Title card
// ───────────────────────────────────────────────────────────────────────────

function TitleScene() {
  const lines = [
    { text: 'Nomenclature has been chosen for the season ahead.', cls: 'so-splash__title-eyebrow', y: 270 },
    { text: 'Which path will you choose?', cls: 'so-splash__title-sub', y: 330 },
  ];
  return (
    <g className="so-splash__scene so-splash__scene--title">
      <rect width="1024" height="576" fill="#0e0a1c" />
      {lines.map((ln, i) => (
        <g key={i} className="so-splash__title-line" style={{ '--i': i }}>
          <text x="512" y={ln.y} textAnchor="middle" className={ln.cls}>
            {ln.text}
          </text>
        </g>
      ))}
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 2 — Dark forest approach
// ───────────────────────────────────────────────────────────────────────────

function ForestTree({ x, h, lean }) {
  const w = h * 0.32;
  return (
    <g transform={`translate(${x} 576) rotate(${lean})`}>
      <rect x={-4} y={-32} width={8} height={32} fill="#0a0e10" />
      <polygon points={`0,${-h} ${w * 0.65},${-h * 0.62} ${-w * 0.65},${-h * 0.62}`} fill="#0d1a15" />
      <polygon points={`0,${-h * 0.78} ${w * 0.8},${-h * 0.4} ${-w * 0.8},${-h * 0.4}`} fill="#0a1612" />
      <polygon points={`0,${-h * 0.55} ${w},${-h * 0.18} ${-w},${-h * 0.18}`} fill="#0d1a15" />
    </g>
  );
}

function DarkForestScene() {
  return (
    <g className="so-splash__scene so-splash__scene--forest">
      <rect width="1024" height="576" fill="url(#so-forest-bg)" />
      {/* Sunbeam cone slicing from upper right to centre-left */}
      <polygon
        points="1024,0 1024,80 380,360 240,360"
        fill="rgba(255,210,150,0.08)"
      />
      <polygon
        points="980,0 1024,0 460,360 380,360"
        fill="rgba(255,225,170,0.06)"
      />
      {/* Back layer trees (smaller, darker) */}
      {FOREST_TREES_BACK.map((t, i) => (
        <ForestTree key={`b${i}`} x={t.x} h={t.h} lean={t.lean} />
      ))}
      {/* Front layer trees (bigger) */}
      {FOREST_TREES_FRONT.map((t, i) => (
        <ForestTree key={`f${i}`} x={t.x} h={t.h} lean={t.lean} />
      ))}
      {/* Ground mist */}
      <rect x="0" y="476" width="1024" height="100" fill="url(#so-forest-mist)" opacity="0.35" />
      {/* 8 manager silhouettes filing through */}
      <g className="so-splash__forest-managers" style={{ filter: 'brightness(0.35) saturate(0.6)' }}>
        {SEASON_OPENER_MANAGERS.map((m, i) => {
          const entry = FOREST_MANAGER_ENTRIES[i];
          return (
            <ManagerDot
              key={m.id}
              manager={m}
              i={i}
              finalX={entry.finalX}
              finalY={entry.finalY}
              enterDx={entry.enterDx}
              enterDy={entry.enterDy}
              w1Dx={0}
              w1Dy={0}
              sceneClass="so-splash__manager--forest"
            />
          );
        })}
      </g>
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 3 — Hobbiton hillside (everything but the door panel)
// ───────────────────────────────────────────────────────────────────────────

function HobbitonChimney({ x, y }) {
  return (
    <g>
      <rect x={x - 6} y={y} width={12} height={20} fill="#8a6a4a" />
      <rect x={x - 6} y={y} width={12} height={3} fill="#5a4030" />
      <ellipse cx={x} cy={y - 8} rx={8} ry={5} fill="rgba(255,255,255,0.55)" />
      <ellipse cx={x - 4} cy={y - 16} rx={10} ry={6} fill="rgba(255,255,255,0.45)" />
      <ellipse cx={x + 3} cy={y - 26} rx={12} ry={7} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

function HobbitonPine({ x, h }) {
  const w = h * 0.4;
  return (
    <g transform={`translate(${x} 530)`}>
      <rect x={-5} y={-22} width={10} height={22} fill="#5a3a25" />
      <polygon points={`0,${-h} ${w * 0.55},${-h * 0.6} ${-w * 0.55},${-h * 0.6}`} fill="#2a5a32" />
      <polygon points={`0,${-h * 0.75} ${w * 0.7},${-h * 0.38} ${-w * 0.7},${-h * 0.38}`} fill="#1f4a28" />
      <polygon points={`0,${-h * 0.5} ${w * 0.85},${-h * 0.15} ${-w * 0.85},${-h * 0.15}`} fill="#2a5a32" />
    </g>
  );
}

function HobbitonDeciduous({ x, h }) {
  const cw = h * 0.55;
  return (
    <g transform={`translate(${x} 530)`}>
      <rect x={-6} y={-h * 0.45} width={12} height={h * 0.45} fill="#5a3a25" />
      <ellipse cx={0} cy={-h * 0.62} rx={cw} ry={h * 0.28} fill="#3a8a3a" />
      <ellipse cx={-cw * 0.45} cy={-h * 0.78} rx={cw * 0.6} ry={h * 0.24} fill="#48a048" />
      <ellipse cx={cw * 0.4} cy={-h * 0.8} rx={cw * 0.55} ry={h * 0.22} fill="#48a048" />
    </g>
  );
}

function HobbitonScene() {
  return (
    <g className="so-splash__scene so-splash__scene--hobbiton">
      {/* Sky */}
      <rect width="1024" height="320" fill="url(#so-hobbiton-sky)" />
      {/* Sun */}
      <circle cx={180} cy={90} r={36} fill="#fff4c8" opacity="0.85" />
      <circle cx={180} cy={90} r={58} fill="#fff4c8" opacity="0.18" />
      {/* Clouds */}
      <g fill="rgba(255,255,255,0.78)">
        <ellipse cx={340} cy={80} rx={70} ry={18} />
        <ellipse cx={380} cy={68} rx={50} ry={14} />
        <ellipse cx={820} cy={110} rx={90} ry={20} />
        <ellipse cx={870} cy={96} rx={55} ry={14} />
        <ellipse cx={560} cy={50} rx={48} ry={11} />
      </g>
      {/* Rolling hill */}
      <path
        d="M 0 320 C 160 240 320 290 480 270 C 640 250 780 300 920 280 C 980 272 1024 286 1024 286 L 1024 576 L 0 576 Z"
        fill="#6ab64a"
      />
      {/* Darker hill shadow band */}
      <path
        d="M 0 480 C 200 460 420 490 620 478 C 800 468 940 488 1024 482 L 1024 576 L 0 576 Z"
        fill="#4a8a3a"
      />
      {/* Background hobbit-hole chimneys (smoke wisps) */}
      {HOBBITON_CHIMNEYS.map((c, i) => (
        <HobbitonChimney key={i} x={c.x} y={c.y} />
      ))}
      {/* Trees */}
      {HOBBITON_TREES.map((t, i) =>
        t.type === 'pine' ? (
          <HobbitonPine key={i} x={t.x} h={t.h} />
        ) : (
          <HobbitonDeciduous key={i} x={t.x} h={t.h} />
        ),
      )}
      {/* Bag End — non-door pieces (door panel itself lives in DoorRevealScene) */}
      {/* Inner plaster wall behind the door opening (visible as the doorway border) */}
      <circle cx={780} cy={300} r={74} fill="#e8c87d" />
      {/* Brick arch around door */}
      <circle
        cx={780}
        cy={300}
        r={80}
        fill="none"
        stroke="#c66a3d"
        strokeWidth={14}
      />
      {/* Wood overhang above the arch */}
      <path
        d="M 690 218 Q 780 188 870 218 L 862 232 Q 780 208 698 232 Z"
        fill="#5a3a25"
      />
      {/* Lantern hanging from overhang (left of door) */}
      <line x1={702} y1={220} x2={702} y2={246} stroke="#3a2418" strokeWidth={1.5} />
      <rect x={696} y={246} width={12} height={16} fill="#c4a04d" stroke="#5a3a18" strokeWidth={1} />
      <circle cx={702} cy={254} r={4} fill="#ffd88a" opacity="0.9" />
      {/* Stone steps below the door */}
      <rect x={720} y={372} width={120} height={10} fill="#a8a098" stroke="#7c7068" strokeWidth={0.5} />
      <rect x={708} y={386} width={144} height={10} fill="#b4ada3" stroke="#7c7068" strokeWidth={0.5} />
      <rect x={696} y={400} width={168} height={10} fill="#a8a098" stroke="#7c7068" strokeWidth={0.5} />
      <rect x={684} y={414} width={192} height={10} fill="#b4ada3" stroke="#7c7068" strokeWidth={0.5} />
      {/* Wildflowers scattered near steps */}
      <g>
        {HOBBITON_FLOWERS.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={2} fill={f.colour} />
        ))}
      </g>
      {/* 8 manager dots emerging from edges and walking to a semicircle in front of door */}
      <g className="so-splash__hobbiton-managers">
        {SEASON_OPENER_MANAGERS.map((m, i) => {
          const entry = HOBBITON_MANAGER_ENTRIES[i];
          return (
            <ManagerDot
              key={m.id}
              manager={m}
              i={i}
              finalX={entry.finalX}
              finalY={entry.finalY}
              enterDx={entry.enterDx}
              enterDy={entry.enterDy}
              w1Dx={entry.w1Dx}
              w1Dy={entry.w1Dy}
              sceneClass="so-splash__manager--hobbiton"
            />
          );
        })}
      </g>
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 4a — Door swing + reveal (sits on top of Hobbiton, same backdrop)
// ───────────────────────────────────────────────────────────────────────────

function DoorRevealScene() {
  return (
    <g className="so-splash__scene so-splash__scene--door">
      {/* Dark interior behind the door */}
      <circle cx={780} cy={300} r={66} fill="#120a08" />
      {/* Amber glow inside the doorway */}
      <circle
        cx={780}
        cy={300}
        r={66}
        fill="url(#so-amber-glow)"
        className="so-splash__amber-glow"
      />
      {/* Vader silhouette inside the doorway */}
      <VaderHelmet
        cx={780}
        cy={314}
        w={80}
        h={102}
        className="so-splash__doorway-vader"
      />
      {/* Door panel — rotates open around its left edge */}
      <g className="so-splash__door-panel">
        <circle
          cx={780}
          cy={300}
          r={66}
          fill="#3d7e4a"
          stroke="#1f4a28"
          strokeWidth={2}
        />
        {/* Plank lines */}
        <line x1={716} y1={272} x2={844} y2={272} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        <line x1={716} y1={300} x2={844} y2={300} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        <line x1={716} y1={328} x2={844} y2={328} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        {/* Brass knob — slightly off-centre to suggest a real door knob */}
        <circle cx={808} cy={302} r={4.5} fill="#e0bf5d" stroke="#7a5a18" strokeWidth={0.8} />
      </g>
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 4b — Vader full reveal + caption stack
// ───────────────────────────────────────────────────────────────────────────

function VaderScene() {
  return (
    <g className="so-splash__scene so-splash__scene--vader">
      <rect width="1024" height="576" fill="#1a0a14" />
      {/* Diffuse rear glow behind Vader */}
      <circle cx={512} cy={300} r={240} fill="#3a1830" opacity="0.55" />
      <circle cx={512} cy={300} r={140} fill="#5a2848" opacity="0.4" />
      {/* Vader silhouette, hero scale */}
      <VaderHelmet
        cx={512}
        cy={300}
        w={200}
        h={260}
        className="so-splash__vader-figure"
      />
      {/* The One Ring */}
      <g className="so-splash__ring-wrap">
        <circle
          cx={512}
          cy={300}
          r={80}
          fill="none"
          stroke="#d4af37"
          strokeWidth={5}
          className="so-splash__ring"
        />
        {/* Inner glint */}
        <circle
          cx={512}
          cy={300}
          r={80}
          fill="none"
          stroke="#fff3b0"
          strokeWidth={1.4}
          opacity={0.6}
        />
        {/* Optional Elvish inscription along inner radius */}
        <text className="so-splash__ring-inscription">
          <textPath href="#so-ring-inscription-path" startOffset="0">
            Ash nazg durbatulûk · Ash nazg gimbatul · Ash nazg thrakatulûk
          </textPath>
        </text>
      </g>
      {/* Lower-third caption bar */}
      <rect x={0} y={476} width={1024} height={60} fill="rgba(0,0,0,0.85)" />
      <rect x={0} y={474} width={1024} height={2} fill="rgba(212,175,55,0.55)" />
      {VADER_LINES.map((line, i) => (
        <text
          key={i}
          x={512}
          y={514}
          textAnchor="middle"
          className={`so-splash__vader-line so-splash__vader-line--${i}`}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Reusable bits
// ───────────────────────────────────────────────────────────────────────────

function VaderHelmet({ cx, cy, w, h, className }) {
  const sx = w / 100;
  const sy = h / 130;
  return (
    <g
      className={className}
      transform={`translate(${cx} ${cy}) scale(${sx} ${sy}) translate(-50 -65)`}
    >
      {/* Helmet dome */}
      <path
        d="M 22 32 Q 22 6 50 6 Q 78 6 78 32 L 78 56 Q 76 70 64 80 L 36 80 Q 24 70 22 56 Z"
        fill="#000"
      />
      {/* Brow ridge */}
      <path d="M 28 30 Q 50 22 72 30 L 72 36 Q 50 30 28 36 Z" fill="#1a1a1a" />
      {/* Eye lens slits */}
      <path d="M 32 42 Q 40 38 48 42 L 48 48 Q 40 46 32 48 Z" fill="#1a1a1a" />
      <path d="M 52 42 Q 60 38 68 42 L 68 48 Q 60 46 52 48 Z" fill="#1a1a1a" />
      {/* Cape / shoulder mass */}
      <path d="M 26 78 L 74 78 L 92 130 L 8 130 Z" fill="#000" />
      {/* Chest box backdrop */}
      <rect x={36} y={86} width={28} height={26} fill="#0c0c0c" />
      {/* Breathing grille T-bar */}
      <rect x={46} y={86} width={8} height={22} fill="#1c1c1c" />
      <rect x={38} y={94} width={24} height={5} fill="#1c1c1c" />
    </g>
  );
}

function ManagerDot({ manager, i, finalX, finalY, enterDx, enterDy, w1Dx, w1Dy, sceneClass }) {
  return (
    <g
      className={`so-splash__manager ${sceneClass}`}
      style={{
        '--colour': manager.colour,
        '--i': i,
        '--enter-dx': `${enterDx}px`,
        '--enter-dy': `${enterDy}px`,
        '--w1-dx': `${w1Dx}px`,
        '--w1-dy': `${w1Dy}px`,
        transform: `translate(${finalX}px, ${finalY}px)`,
      }}
    >
      <g className="so-splash__manager-walk">
        <path
          d="M -18 -2 Q -22 18 -10 26 L 10 26 Q 22 18 18 -2 Z"
          fill="var(--colour)"
          opacity="0.7"
          style={{ filter: 'brightness(0.65)' }}
        />
        <path
          d="M -10 -8 Q 0 -16 10 -8 L 10 0 Q 0 -2 -10 0 Z"
          fill="var(--colour)"
          opacity="0.95"
        />
        <circle r="9" fill="var(--colour)" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
        <text className="so-splash__manager-label" y="42" textAnchor="middle">
          {manager.surname}
        </text>
      </g>
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

// Dark forest: trees fixed at hand-picked x positions across both layers,
// staggered heights / leans for a "deep woods" silhouette.
const FOREST_TREES_BACK = [
  { x: 40,  h: 300, lean: -1 },
  { x: 130, h: 280, lean: 2 },
  { x: 240, h: 330, lean: -2 },
  { x: 350, h: 290, lean: 1 },
  { x: 470, h: 320, lean: -1 },
  { x: 600, h: 310, lean: 2 },
  { x: 720, h: 290, lean: -2 },
  { x: 840, h: 320, lean: 1 },
  { x: 960, h: 300, lean: -1 },
];
const FOREST_TREES_FRONT = [
  { x: 80,  h: 430, lean: -2 },
  { x: 280, h: 460, lean: 3 },
  { x: 480, h: 440, lean: -1 },
  { x: 700, h: 470, lean: 2 },
  { x: 920, h: 430, lean: -3 },
];

// All 8 forest managers walk in single file across the middle, all share
// the same off-screen-left enter offset; finalY varies for a natural
// winding line. The wrapper sits at finalX; the keyframe drives the dot
// from translate(--enter-dx, --enter-dy) through (0,0) and on to (1100,0).
const FOREST_MANAGER_ENTRIES = SEASON_OPENER_MANAGERS.map((_, i) => ({
  finalX: 512,
  finalY: 332 + ((i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 6)),
  enterDx: -1100,
  enterDy: 0,
}));

// Hobbiton: 8 hand-authored "random-looking" entry positions along the
// left and bottom edges of the viewBox, paired with final positions
// fanned in a semicircle in front of the Bag End door (cx=780, cy=300).
// w1 = rough midpoint of (enter, final), so each dot takes a slightly
// curved path rather than a straight line.
const HOBBITON_MANAGER_ENTRIES = [
  { finalX: 560, finalY: 430, enterDx: -640, enterDy: -230, w1Dx: -320, w1Dy: -115 },
  { finalX: 615, finalY: 460, enterDx: -665, enterDy: -60,  w1Dx: -332, w1Dy: -30  },
  { finalX: 685, finalY: 490, enterDx: -785, enterDy:  60,  w1Dx: -392, w1Dy:  30  },
  { finalX: 760, finalY: 510, enterDx: -560, enterDy: 170,  w1Dx: -280, w1Dy:  85  },
  { finalX: 835, finalY: 490, enterDx: -335, enterDy: 190,  w1Dx: -167, w1Dy:  95  },
  { finalX: 905, finalY: 450, enterDx: -105, enterDy: 230,  w1Dx:  -52, w1Dy: 115  },
  { finalX: 940, finalY: 400, enterDx:  160, enterDy: 280,  w1Dx:   80, w1Dy: 140  },
  { finalX: 500, finalY: 380, enterDx: -600, enterDy: -280, w1Dx: -300, w1Dy: -140 },
];

// Background hobbit-hole chimneys peeking out of the hill.
const HOBBITON_CHIMNEYS = [
  { x: 130, y: 340 },
  { x: 280, y: 370 },
  { x: 440, y: 350 },
];

// Foreground trees framing the hillside, picked to leave the door
// (x≈700–860) and the manager fan area clear.
const HOBBITON_TREES = [
  { x: 70,  type: 'pine',      h: 170 },
  { x: 210, type: 'deciduous', h: 150 },
  { x: 360, type: 'pine',      h: 130 },
  { x: 1000, type: 'deciduous', h: 140 },
];

// Wildflower cluster near the steps below the door.
const HOBBITON_FLOWERS = [
  { x: 700, y: 432, colour: '#ffd23f' },
  { x: 706, y: 440, colour: '#d63d8a' },
  { x: 712, y: 434, colour: '#ffffff' },
  { x: 850, y: 430, colour: '#d63d8a' },
  { x: 858, y: 436, colour: '#ffd23f' },
  { x: 866, y: 432, colour: '#ffffff' },
  { x: 740, y: 442, colour: '#ffd23f' },
  { x: 820, y: 442, colour: '#d63d8a' },
];
