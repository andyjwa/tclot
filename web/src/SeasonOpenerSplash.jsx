import { useState } from 'react';
import { EPISODE_NUMBER, SEASON_THEME, VADER_LINES, SEASON_OPENER_MANAGERS } from './seasonOpener.js';
import './SeasonOpenerSplash.css';

const SESSION_PLAY_KEY = 'tclot:so:plays:v1';
const SESSION_PLAY_CAP = 2;

/*
 * Season Opener cinematic — six scenes mounted on FPL Live → Vibes.
 * Timeline (cinematic seconds from playId mount):
 *   0–6s    title card
 *   6–18s   dark forest, dots walk in place while backdrop pans (signpost passes by)
 *   18–28s  Hobbiton + Bag End approach
 *   28–34s  door swings open, amber glow + chibi Vader in doorway
 *   34–42s  chibi Vader hero shot + 4-line caption stack
 *   42–52s  TLC wrestling ring outro — all 8 dots ring up for the title
 * Total ≈ 52s. See SeasonOpenerSplash.css for keyframes.
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
          {/* Stormy Bag End sky — matches the iconic reference photo. */}
          <linearGradient id="so-hobbiton-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a8a9a" />
            <stop offset="100%" stopColor="#b8c4cc" />
          </linearGradient>
          <radialGradient id="so-amber-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd28a" stopOpacity="1" />
            <stop offset="55%" stopColor="#ffb24a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffb24a" stopOpacity="0" />
          </radialGradient>
          {/* TLC arena: deep red curtain. */}
          <linearGradient id="so-tlc-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a0a14" />
            <stop offset="100%" stopColor="#2a0a14" />
          </linearGradient>
          {/* Lightsaber blade halo. */}
          <filter id="so-saber-glow" x="-100%" y="-20%" width="300%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <rect width="1024" height="576" fill="#0e0a1c" />
        <TitleScene />
        <DarkForestScene />
        <HobbitonScene />
        <DoorRevealScene />
        <VaderScene />
        <TlcRingScene />
      </svg>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 1 — Title card (0–6s)
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
// Scene 2 — Dark forest side-scroller (6–18s)
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

function ForestSignpost({ x }) {
  // Wooden post + angled plank reading "TC-LOTR →". Plank is rotated 15°
  // clockwise; the text follows the rotation so it stays parallel.
  const baseY = 540;
  const postH = 90;
  return (
    <g transform={`translate(${x} ${baseY})`}>
      <rect x={-3} y={-postH} width={6} height={postH} fill="#5a3a25" />
      <g transform={`translate(0 ${-postH + 8}) rotate(15)`}>
        <rect x={-4} y={-12} width={88} height={26} fill="#6a4a2e" stroke="#3a2418" strokeWidth={1} rx={2} />
        <text x={40} y={6} textAnchor="middle" fill="#f4e8c8" fontSize="14" fontWeight="700" fontFamily="inherit">
          TC-LOTR →
        </text>
      </g>
    </g>
  );
}

function DarkForestScene() {
  return (
    <g className="so-splash__scene so-splash__scene--forest">
      {/* Static night-forest sky (does not pan) */}
      <rect width="1024" height="576" fill="url(#so-forest-bg)" />
      {/* Panning backdrop: trees + sunbeams + ground mist + signpost. */}
      <g className="so-splash__forest-backdrop">
        {/* Two sunbeam cones along the 2200-wide world so we see them as we pan */}
        <polygon points="600,0 600,80 -40,360 -180,360" fill="rgba(255,210,150,0.08)" />
        <polygon points="560,0 600,0 40,360 -40,360"   fill="rgba(255,225,170,0.06)" />
        <polygon points="1900,0 1900,80 1260,360 1120,360" fill="rgba(255,210,150,0.08)" />
        <polygon points="1860,0 1900,0 1340,360 1260,360" fill="rgba(255,225,170,0.06)" />
        {/* Back layer trees */}
        {FOREST_TREES_BACK.map((t, i) => (
          <ForestTree key={`b${i}`} x={t.x} h={t.h} lean={t.lean} />
        ))}
        {/* Front layer trees */}
        {FOREST_TREES_FRONT.map((t, i) => (
          <ForestTree key={`f${i}`} x={t.x} h={t.h} lean={t.lean} />
        ))}
        {/* Wooden signpost roughly midway through the pan */}
        <ForestSignpost x={1100} />
        {/* Ground mist — stretched across the panning world */}
        <rect x="-100" y="476" width="2400" height="100" fill="url(#so-forest-mist)" opacity="0.35" />
      </g>
      {/* 8 manager dots — stationary at centre-left, bobbing to imply walking */}
      <g className="so-splash__forest-managers">
        {SEASON_OPENER_MANAGERS.map((m, i) => {
          const pos = FOREST_DOT_POSITIONS[i];
          return (
            <ManagerDot
              key={m.id}
              manager={m}
              i={i}
              finalX={pos.x}
              finalY={pos.y}
              enterDx={0}
              enterDy={0}
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
// Scene 3 — Hobbiton / Bag End (18–28s)
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

// The iconic Bag End oak — gnarly trunk emerging from behind the hilltop with
// a wide irregular crown that silhouettes against the stormy sky.
function BagEndOak() {
  return (
    <g>
      {/* Trunk + roots */}
      <path d="M 712 220 C 698 180 712 130 706 70 C 700 30 720 20 720 6 L 740 6 C 742 30 752 70 740 130 C 736 170 742 200 740 220 Z" fill="#3a2818" />
      {/* Lower branches splaying out behind the crown */}
      <path d="M 720 130 C 700 110 660 100 620 80 M 720 130 C 760 110 820 100 860 80 M 720 100 C 680 90 640 80 600 70 M 720 100 C 770 90 810 80 860 70" stroke="#3a2818" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Crown — layered ellipses for an irregular shape */}
      <ellipse cx={730} cy={70} rx={170} ry={42} fill="#3a6a2a" opacity="0.92" />
      <ellipse cx={640} cy={60} rx={90}  ry={32} fill="#4a7a3a" opacity="0.88" />
      <ellipse cx={830} cy={56} rx={100} ry={34} fill="#4a7a3a" opacity="0.88" />
      <ellipse cx={730} cy={40} rx={130} ry={28} fill="#5a8a4a" opacity="0.85" />
      <ellipse cx={690} cy={30} rx={70}  ry={20} fill="#5a8a4a" opacity="0.78" />
      <ellipse cx={790} cy={28} rx={80}  ry={22} fill="#5a8a4a" opacity="0.78" />
    </g>
  );
}

function HobbitonScene() {
  return (
    <g className="so-splash__scene so-splash__scene--hobbiton">
      {/* Stormy sky */}
      <rect width="1024" height="320" fill="url(#so-hobbiton-sky)" />
      {/* Elongated clouds for a moody overcast feel */}
      <g fill="rgba(245,245,250,0.55)">
        <ellipse cx={340} cy={80}  rx={120} ry={14} />
        <ellipse cx={400} cy={66}  rx={90}  ry={11} />
        <ellipse cx={820} cy={110} rx={160} ry={16} />
        <ellipse cx={880} cy={94}  rx={100} ry={12} />
        <ellipse cx={120} cy={140} rx={140} ry={13} />
        <ellipse cx={560} cy={50}  rx={88}  ry={10} />
      </g>
      {/* The iconic Bag End oak above and slightly left of the door */}
      <BagEndOak />
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
      {/* Background hobbit-hole chimneys */}
      {HOBBITON_CHIMNEYS.map((c, i) => (
        <HobbitonChimney key={i} x={c.x} y={c.y} />
      ))}
      {/* Background pines/decid */}
      {HOBBITON_TREES.map((t, i) =>
        t.type === 'pine' ? (
          <HobbitonPine key={i} x={t.x} h={t.h} />
        ) : (
          <HobbitonDeciduous key={i} x={t.x} h={t.h} />
        ),
      )}
      {/* Inner plaster wall behind the door opening */}
      <circle cx={780} cy={300} r={74} fill="#e8c87d" />
      {/* Brick arch around door */}
      <circle cx={780} cy={300} r={80} fill="none" stroke="#c66a3d" strokeWidth={14} />
      {/* Two small round side windows */}
      <circle cx={680} cy={300} r={14} fill="#fff4d8" stroke="#c66a3d" strokeWidth={4} />
      <circle cx={880} cy={300} r={14} fill="#fff4d8" stroke="#c66a3d" strokeWidth={4} />
      {/* Wood overhang above the door */}
      <path d="M 686 216 Q 780 184 874 216 L 868 232 Q 780 204 692 232 Z" fill="#5a3a25" />
      <path d="M 690 232 Q 780 210 870 232" stroke="#3a2418" strokeWidth={1} fill="none" opacity="0.6" />
      {/* Brass lantern hanging from the overhang centre */}
      <rect x={778} y={222} width={2} height={6} fill="#3a2418" />
      <rect x={774} y={228} width={10} height={14} fill="#c4a04d" stroke="#5a3a18" strokeWidth={0.8} />
      <circle cx={779} cy={236} r={3.5} fill="#ffd88a" opacity="0.92" />
      {/* Ivy spilling down the right side */}
      <g>
        {HOBBITON_IVY.map((iv, i) => (
          <ellipse key={i} cx={iv.x} cy={iv.y} rx={iv.rx} ry={iv.ry} fill={iv.fill} opacity={iv.opacity} />
        ))}
      </g>
      {/* Terracotta brick steps */}
      <rect x={720} y={372} width={120} height={12} fill="#c66a3d" stroke="#7a3a1a" strokeWidth={0.6} />
      <rect x={708} y={388} width={144} height={12} fill="#b85a30" stroke="#7a3a1a" strokeWidth={0.6} />
      <rect x={696} y={404} width={168} height={12} fill="#c66a3d" stroke="#7a3a1a" strokeWidth={0.6} />
      <rect x={684} y={420} width={192} height={12} fill="#b85a30" stroke="#7a3a1a" strokeWidth={0.6} />
      {/* Abundant wildflower garden */}
      <g>
        {HOBBITON_FLOWERS.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.r ?? 2.5} fill={f.colour} />
        ))}
      </g>
      {/* 8 manager dots fanning to a semicircle in front of Bag End */}
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
// Scene 4a — Door swing + reveal (28–34s, overlays Hobbiton)
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
      {/* Chibi Vader inside the doorway (no saber — too cramped) */}
      <VaderChibi cx={780} cy={322} w={80} h={102} withSaber={false} className="so-splash__doorway-vader" />
      {/* Door panel — hinges open around its left edge */}
      <g className="so-splash__door-panel">
        <circle cx={780} cy={300} r={66} fill="#3d7e4a" stroke="#1f4a28" strokeWidth={2} />
        <line x1={716} y1={272} x2={844} y2={272} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        <line x1={716} y1={300} x2={844} y2={300} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        <line x1={716} y1={328} x2={844} y2={328} stroke="#1f4a28" strokeWidth={1} opacity="0.55" />
        <circle cx={808} cy={302} r={4.5} fill="#e0bf5d" stroke="#7a5a18" strokeWidth={0.8} />
      </g>
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Scene 4b — Vader hero (34–42s)
// ───────────────────────────────────────────────────────────────────────────

function VaderScene() {
  return (
    <g className="so-splash__scene so-splash__scene--vader">
      <rect width="1024" height="576" fill="#1a0a14" />
      <circle cx={512} cy={300} r={240} fill="#3a1830" opacity="0.55" />
      <circle cx={512} cy={300} r={140} fill="#5a2848" opacity="0.4" />
      {/* Chibi Vader hero-scale with red lightsaber */}
      <VaderChibi cx={512} cy={300} w={280} h={340} withSaber className="so-splash__vader-figure" />
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
// Scene 5 — TLC wrestling ring outro (42–52s)
// ───────────────────────────────────────────────────────────────────────────

function CartoonLadder({ x, y, rot }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <line x1={0}  y1={0} x2={0}  y2={120} stroke="#c4c4d4" strokeWidth={4} strokeLinecap="round" />
      <line x1={26} y1={0} x2={26} y2={120} stroke="#c4c4d4" strokeWidth={4} strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <line key={r} x1={-2} y1={10 + r * 22} x2={28} y2={10 + r * 22} stroke="#c4c4d4" strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* Cartoon outline */}
      <line x1={0}  y1={0} x2={0}  y2={120} stroke="#0a0a0a" strokeWidth={1.2} />
      <line x1={26} y1={0} x2={26} y2={120} stroke="#0a0a0a" strokeWidth={1.2} />
    </g>
  );
}

function CartoonTable({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={88} height={18} fill="#7a4a28" stroke="#0a0a0a" strokeWidth={2} rx={2} />
      <line x1={6}  y1={18} x2={2}  y2={48} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={26} y1={18} x2={24} y2={48} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={62} y1={18} x2={64} y2={48} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={82} y1={18} x2={86} y2={48} stroke="#0a0a0a" strokeWidth={2} />
    </g>
  );
}

function CartoonChair({ x, y, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={0}  y={0}  width={20} height={26} fill="#2a2a2a" stroke="#0a0a0a" strokeWidth={2} rx={1.5} />
      <rect x={-2} y={26} width={24} height={6}  fill="#2a2a2a" stroke="#0a0a0a" strokeWidth={2} rx={1.5} />
      <line x1={2}  y1={32} x2={2}  y2={48} stroke="#0a0a0a" strokeWidth={2} />
      <line x1={18} y1={32} x2={18} y2={48} stroke="#0a0a0a" strokeWidth={2} />
    </g>
  );
}

function TlcRingScene() {
  return (
    <g className="so-splash__scene so-splash__scene--tlc">
      <rect width="1024" height="576" fill="url(#so-tlc-bg)" />
      {/* Stadium light fan — long thin cones from the top corners */}
      <g opacity="0.18">
        <polygon points="60,0 0,200 0,40"      fill="#ffffff" />
        <polygon points="120,0 60,260 0,160"   fill="#ffd8e4" />
        <polygon points="960,0 1024,200 1024,40"   fill="#ffffff" />
        <polygon points="900,0 960,260 1024,160"   fill="#ffd8e4" />
        <polygon points="512,0 480,220 544,220"    fill="#ffffff" opacity="0.6" />
      </g>
      {/* Hanging gold ring (TLC prize) with chain from ceiling, swinging gently */}
      <g className="so-splash__tlc-ring">
        <line x1={512} y1={0} x2={512} y2={76} stroke="#cccccc" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={512} cy={120} r={50} fill="none" stroke="#fff4c8" strokeWidth={12} opacity={0.4} />
        <circle cx={512} cy={120} r={44} fill="none" stroke="#d4af37" strokeWidth={8} />
        <circle cx={512} cy={120} r={44} fill="none" stroke="#fff3b0" strokeWidth={1.5} opacity={0.7} />
      </g>
      {/* ──────────────────────────────────────────────────────────────── */}
      {/* 3/4 perspective wrestling ring                                   */}
      {/* ──────────────────────────────────────────────────────────────── */}
      {/* Layering note: mat + apron + accessories render BEFORE the dots; */}
      {/* all 4 posts and all 12 rope segments render AFTER the dots so    */}
      {/* the dots appear contained inside the ring. Ropes are thin enough */}
      {/* that dots remain readable through them.                          */}

      {/* Side aprons (left/right faces of the platform below the mat) — */}
      {/* drawn first so the front apron rect sits in front of them.     */}
      <polygon
        points="170,480 260,340 260,376 170,516"
        fill="#1a1a26"
        stroke="#0a0a0a"
        strokeWidth={1.5}
      />
      <polygon
        points="854,480 764,340 764,376 854,516"
        fill="#1a1a26"
        stroke="#0a0a0a"
        strokeWidth={1.5}
      />
      {/* Front apron band */}
      <polygon
        points="170,480 854,480 854,516 170,516"
        fill="#1a1a26"
        stroke="#0a0a0a"
        strokeWidth={2}
      />
      {/* Front apron top-edge highlight */}
      <line x1={170} y1={480} x2={854} y2={480} stroke="#3a3a4a" strokeWidth={2} />
      {/* Ring mat trapezoid (back edge shorter than front to imply depth) */}
      <polygon
        points="260,340 764,340 854,480 170,480"
        fill="#7a1a24"
        stroke="#1a1a26"
        strokeWidth={3}
      />
      {/* Cartoony TLC accessories OUTSIDE the ring */}
      <CartoonLadder x={72}  y={350} rot={12} />
      <CartoonLadder x={908} y={350} rot={-10} />
      <CartoonTable  x={30}  y={520} />
      <CartoonTable  x={880} y={520} />
      <CartoonChair  x={160} y={508} rot={-6} />
      <CartoonChair  x={836} y={506} rot={5} />
      <CartoonChair  x={460} y={534} rot={-2} />
      {/* All 8 manager dots filing into the ring (two rows for depth) */}
      <g className="so-splash__tlc-managers">
        {SEASON_OPENER_MANAGERS.map((m, i) => {
          const pos = TLC_DOT_POSITIONS[i];
          return (
            <ManagerDot
              key={m.id}
              manager={m}
              i={i}
              finalX={pos.x}
              finalY={pos.y}
              enterDx={pos.enterDx}
              enterDy={pos.enterDy}
              w1Dx={0}
              w1Dy={0}
              scale={pos.scale}
              sceneClass="so-splash__manager--tlc"
            />
          );
        })}
      </g>
      {/* Posts + ropes rendered AFTER dots so the ring visually frames them */}
      {/* Back posts (smaller — further away) */}
      {[
        { x: 254, y: 240 },
        { x: 758, y: 240 },
      ].map((p, idx) => (
        <g key={`back-post-${idx}`}>
          <rect x={p.x} y={p.y} width={12} height={100} fill="#1a1a26" stroke="#0a0a0a" strokeWidth={1.5} />
          <rect x={p.x - 2} y={p.y - 14} width={16} height={14} fill="#ffd23f" stroke="#0a0a0a" strokeWidth={1.5} />
        </g>
      ))}
      {/* Front posts (larger — closer) */}
      {[
        { x: 164, y: 360 },
        { x: 848, y: 360 },
      ].map((p, idx) => (
        <g key={`front-post-${idx}`}>
          <rect x={p.x} y={p.y} width={14} height={120} fill="#1a1a26" stroke="#0a0a0a" strokeWidth={1.5} />
          <rect x={p.x - 2} y={p.y - 16} width={18} height={16} fill="#ffd23f" stroke="#0a0a0a" strokeWidth={1.5} />
        </g>
      ))}
      {/* Ropes — three tiers, each tier connects all 4 corner anchors so */}
      {/* every side of the ring reads. Corner anchors per tier:          */}
      {/*   tier 1 (top):    BL(260,240) BR(764,240) FR(855,360) FL(171,360) */}
      {/*   tier 2 (middle): BL(260,280) BR(764,280) FR(855,400) FL(171,400) */}
      {/*   tier 3 (bottom): BL(260,320) BR(764,320) FR(855,440) FL(171,440) */}
      {[
        { bl: [260, 240], br: [764, 240], fr: [855, 360], fl: [171, 360] },
        { bl: [260, 280], br: [764, 280], fr: [855, 400], fl: [171, 400] },
        { bl: [260, 320], br: [764, 320], fr: [855, 440], fl: [171, 440] },
      ].map((t, idx) => {
        const segs = [
          { a: t.bl, b: t.br }, // back
          { a: t.br, b: t.fr }, // right side
          { a: t.fr, b: t.fl }, // front
          { a: t.fl, b: t.bl }, // left side
        ];
        return (
          <g key={`rope-tier-${idx}`}>
            {segs.map((s, sidx) => (
              <g key={sidx}>
                <line
                  x1={s.a[0]} y1={s.a[1] + 2}
                  x2={s.b[0]} y2={s.b[1] + 2}
                  stroke="#3a3a4a" strokeWidth={2}
                />
                <line
                  x1={s.a[0]} y1={s.a[1]}
                  x2={s.b[0]} y2={s.b[1]}
                  stroke="#ffffff" strokeWidth={3}
                />
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Reusable bits
// ───────────────────────────────────────────────────────────────────────────

/**
 * Chibi-style Vader silhouette: wide bell helmet, red eye lenses, mouth
 * grille, cape, chest control panel, and (optional) red lightsaber.
 * The shapes are designed in a 100×130 coord box, then scaled to (w, h)
 * and re-centred on (cx, cy).
 */
function VaderChibi({ cx, cy, w, h, withSaber = false, className }) {
  const sx = w / 100;
  const sy = h / 130;
  return (
    <g className={className} transform={`translate(${cx} ${cy}) scale(${sx} ${sy}) translate(-50 -65)`}>
      {/* Cape behind the body, flaring outward */}
      <path d="M 22 78 L 78 78 L 96 130 L 4 130 Z" fill="#0a0a0a" />
      <path d="M 22 78 L 50 92 L 50 130 L 4 130 Z" fill="#050505" />
      {/* Body / torso */}
      <path d="M 32 78 L 68 78 L 74 122 L 26 122 Z" fill="#1a1a1a" stroke="#0a0a0a" strokeWidth={0.8} />
      {/* Belt */}
      <rect x={28} y={104} width={44} height={5} fill="#2a2a2a" />
      <rect x={47} y={102} width={6}  height={9} fill="#3a3a3a" stroke="#0a0a0a" strokeWidth={0.5} />
      {/* Chest control panel — small red+green grid */}
      <rect x={42} y={86} width={16} height={12} fill="#101010" stroke="#3a3a3a" strokeWidth={0.5} />
      <rect x={44} y={88} width={4} height={3} fill="#e63a3a" />
      <rect x={49} y={88} width={4} height={3} fill="#3aff66" />
      <rect x={54} y={88} width={3} height={3} fill="#3a8aff" />
      <rect x={44} y={92} width={3} height={3} fill="#3aff66" />
      <rect x={48} y={92} width={4} height={3} fill="#e63a3a" />
      <rect x={53} y={92} width={4} height={3} fill="#ffd23f" />
      {/* Helmet — wide rounded bell silhouette */}
      <path d="M 24 30 Q 24 4 50 4 Q 76 4 76 30 L 80 56 Q 78 72 64 80 L 36 80 Q 22 72 20 56 Z" fill="#0a0a0a" />
      {/* Helmet centre crease */}
      <path d="M 50 6 L 50 80" stroke="#1a1a1a" strokeWidth={1.2} opacity="0.85" />
      {/* Brow ridge highlight */}
      <path d="M 28 30 Q 50 22 72 30 L 72 36 Q 50 30 28 36 Z" fill="#1a1a1a" />
      {/* Eye lenses — big rounded ovals with a red glow */}
      <ellipse cx={37} cy={42} rx={9} ry={6} fill="#1a1a1a" />
      <ellipse cx={63} cy={42} rx={9} ry={6} fill="#1a1a1a" />
      <ellipse cx={37} cy={42} rx={7} ry={4.5} fill="rgba(180,30,30,0.85)" />
      <ellipse cx={63} cy={42} rx={7} ry={4.5} fill="rgba(180,30,30,0.85)" />
      <ellipse cx={35} cy={40} rx={2} ry={1.2} fill="#ffd0d0" opacity="0.75" />
      <ellipse cx={61} cy={40} rx={2} ry={1.2} fill="#ffd0d0" opacity="0.75" />
      {/* Mouth grille — light grey backdrop + darker vertical strips */}
      <rect x={40} y={56} width={20} height={14} fill="#3a3a3a" stroke="#0a0a0a" strokeWidth={0.6} rx={1.5} />
      {[0, 1, 2, 3, 4].map((s) => (
        <rect key={s} x={42 + s * 3.5} y={58} width={1.5} height={10} fill="#1a1a1a" />
      ))}
      {/* Cheek "tusks" of helmet flaring out */}
      <path d="M 22 58 Q 18 64 24 72 L 30 72 Z" fill="#0a0a0a" />
      <path d="M 78 58 Q 82 64 76 72 L 70 72 Z" fill="#0a0a0a" />
      {/* Red lightsaber, angled 25° from vertical, sprouting from his right side */}
      {withSaber ? (
        <g transform="translate(80 100) rotate(25)">
          {/* Glow halo */}
          <rect x={-6} y={-150} width={12} height={150} fill="#ff3030" opacity="0.55" filter="url(#so-saber-glow)" />
          {/* Hilt */}
          <rect x={-4} y={0} width={8} height={16} fill="#3a3a3a" stroke="#0a0a0a" strokeWidth={0.5} />
          <rect x={-4} y={4} width={8} height={2}  fill="#1a1a1a" />
          {/* Blade core */}
          <rect x={-3} y={-150} width={6} height={150} fill="#ff3030" />
          <rect x={-1.2} y={-150} width={2.4} height={150} fill="#ffd0d0" opacity="0.9" />
        </g>
      ) : null}
    </g>
  );
}

function ManagerDot({ manager, i, finalX, finalY, enterDx, enterDy, w1Dx, w1Dy, sceneClass, scale = 1 }) {
  // Scale is composed AFTER the translate in the CSS transform string so the
  // dot scales around its own local origin (0,0) and then settles at
  // (finalX, finalY) — used by TLC back-row dots to imply distance.
  const transform = scale === 1
    ? `translate(${finalX}px, ${finalY}px)`
    : `translate(${finalX}px, ${finalY}px) scale(${scale})`;
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
        transform,
      }}
    >
      <g className="so-splash__manager-walk">
        <g className="so-splash__manager-ready">
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
    </g>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

// Forest backdrop: trees laid out across a 2200-wide world so when the
// .so-splash__forest-backdrop group pans -1200px there is always foliage
// on screen. Heights/leans staggered for depth.
const FOREST_TREES_BACK = [
  { x: 40,   h: 300, lean: -1 }, { x: 160,  h: 280, lean: 2 },
  { x: 280,  h: 330, lean: -2 }, { x: 420,  h: 290, lean: 1 },
  { x: 540,  h: 320, lean: -1 }, { x: 680,  h: 310, lean: 2 },
  { x: 820,  h: 290, lean: -2 }, { x: 960,  h: 320, lean: 1 },
  { x: 1080, h: 300, lean: -1 }, { x: 1220, h: 330, lean: 2 },
  { x: 1360, h: 290, lean: -1 }, { x: 1490, h: 320, lean: 1 },
  { x: 1620, h: 300, lean: -2 }, { x: 1760, h: 310, lean: 2 },
  { x: 1900, h: 290, lean: -1 }, { x: 2040, h: 320, lean: 1 },
  { x: 2160, h: 300, lean: -1 },
];
const FOREST_TREES_FRONT = [
  { x: 90,   h: 430, lean: -2 }, { x: 320,  h: 460, lean: 3 },
  { x: 560,  h: 440, lean: -1 }, { x: 820,  h: 470, lean: 2 },
  { x: 1040, h: 430, lean: -3 }, { x: 1280, h: 470, lean: 2 },
  { x: 1520, h: 440, lean: -1 }, { x: 1760, h: 460, lean: 3 },
  { x: 1980, h: 430, lean: -2 }, { x: 2180, h: 450, lean: 1 },
];

// Forest dot positions — centre-left/centre cluster, distinct y values
// so the 8 silhouettes don't stack. Dots bob in place; the world pans
// past them.
const FOREST_DOT_POSITIONS = [
  { x: 230, y: 340 },
  { x: 310, y: 360 },
  { x: 270, y: 395 },
  { x: 380, y: 380 },
  { x: 235, y: 420 },
  { x: 340, y: 425 },
  { x: 410, y: 350 },
  { x: 195, y: 405 },
];

// Hobbiton: 8 hand-authored entry positions along the left/bottom edges,
// paired with final positions fanned in a semicircle in front of the
// Bag End door (cx=780, cy=300).
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

const HOBBITON_CHIMNEYS = [
  { x: 130, y: 340 },
  { x: 280, y: 370 },
  { x: 440, y: 350 },
];

const HOBBITON_TREES = [
  { x: 70,  type: 'pine',      h: 170 },
  { x: 210, type: 'deciduous', h: 150 },
  { x: 360, type: 'pine',      h: 130 },
  { x: 1000, type: 'deciduous', h: 140 },
];

// Ivy spilling down the right side of the door area.
const HOBBITON_IVY = [
  { x: 880, y: 240, rx: 14, ry: 10, fill: '#3a6a3a', opacity: 0.85 },
  { x: 890, y: 256, rx: 12, ry: 9,  fill: '#5a8a4a', opacity: 0.78 },
  { x: 902, y: 274, rx: 16, ry: 11, fill: '#3a6a3a', opacity: 0.82 },
  { x: 916, y: 292, rx: 14, ry: 10, fill: '#5a8a4a', opacity: 0.78 },
  { x: 902, y: 314, rx: 12, ry: 9,  fill: '#3a6a3a', opacity: 0.82 },
  { x: 922, y: 332, rx: 16, ry: 11, fill: '#5a8a4a', opacity: 0.78 },
  { x: 906, y: 354, rx: 12, ry: 8,  fill: '#3a6a3a', opacity: 0.78 },
  { x: 924, y: 372, rx: 14, ry: 9,  fill: '#5a8a4a', opacity: 0.72 },
  { x: 670, y: 250, rx: 10, ry: 7,  fill: '#3a6a3a', opacity: 0.75 },
  { x: 656, y: 268, rx: 11, ry: 8,  fill: '#5a8a4a', opacity: 0.72 },
];

// Abundant wildflower garden — densely scattered across the foreground.
const HOBBITON_FLOWERS = [
  { x: 690, y: 444, colour: '#ffd23f', r: 3 },
  { x: 698, y: 452, colour: '#d63d8a', r: 2.5 },
  { x: 706, y: 446, colour: '#ffffff', r: 2 },
  { x: 714, y: 458, colour: '#a48ad6', r: 2.5 },
  { x: 722, y: 466, colour: '#ffd23f', r: 3 },
  { x: 730, y: 472, colour: '#d63d8a', r: 2 },
  { x: 740, y: 462, colour: '#ffffff', r: 2.5 },
  { x: 748, y: 470, colour: '#a48ad6', r: 2.5 },
  { x: 756, y: 458, colour: '#ffd23f', r: 2 },
  { x: 764, y: 466, colour: '#d63d8a', r: 3 },
  { x: 774, y: 474, colour: '#ffffff', r: 2 },
  { x: 782, y: 482, colour: '#ffd23f', r: 2.5 },
  { x: 790, y: 470, colour: '#a48ad6', r: 2 },
  { x: 798, y: 478, colour: '#d63d8a', r: 3 },
  { x: 806, y: 466, colour: '#ffffff', r: 2 },
  { x: 814, y: 460, colour: '#ffd23f', r: 2.5 },
  { x: 822, y: 472, colour: '#d63d8a', r: 2 },
  { x: 830, y: 480, colour: '#a48ad6', r: 2.5 },
  { x: 840, y: 462, colour: '#ffd23f', r: 3 },
  { x: 850, y: 470, colour: '#d63d8a', r: 2 },
  { x: 858, y: 458, colour: '#ffffff', r: 2 },
  { x: 866, y: 464, colour: '#a48ad6', r: 2.5 },
  { x: 874, y: 478, colour: '#ffd23f', r: 2 },
  { x: 660, y: 482, colour: '#d63d8a', r: 2.5 },
  { x: 672, y: 490, colour: '#ffd23f', r: 2 },
  { x: 686, y: 496, colour: '#ffffff', r: 2.5 },
  { x: 700, y: 504, colour: '#a48ad6', r: 2 },
  { x: 716, y: 510, colour: '#d63d8a', r: 3 },
  { x: 736, y: 518, colour: '#ffd23f', r: 2 },
  { x: 754, y: 524, colour: '#ffffff', r: 2.5 },
  { x: 776, y: 530, colour: '#a48ad6', r: 2 },
  { x: 798, y: 524, colour: '#d63d8a', r: 2.5 },
  { x: 820, y: 518, colour: '#ffd23f', r: 3 },
  { x: 842, y: 510, colour: '#ffffff', r: 2 },
  { x: 868, y: 504, colour: '#a48ad6', r: 2.5 },
  { x: 884, y: 496, colour: '#d63d8a', r: 2 },
  { x: 896, y: 488, colour: '#ffd23f', r: 2.5 },
  { x: 906, y: 478, colour: '#ffffff', r: 2 },
];

// TLC final dot positions on the 3/4 perspective mat. Two rows:
//   • Back row (first 4) sits high on the trapezoid and is scaled down
//     to 0.85 to imply distance; enters diagonally from the upper
//     off-screen corners (upstage).
//   • Front row (last 4) sits low on the trapezoid at full scale and
//     enters horizontally from the left/right wings as before.
const TLC_DOT_POSITIONS = [
  // BACK row — y in 370–385, x spread between ~310 and ~710
  { x: 310, y: 372, scale: 0.85, enterDx: -380, enterDy: -300 },
  { x: 443, y: 378, scale: 0.85, enterDx: -200, enterDy: -360 },
  { x: 577, y: 374, scale: 0.85, enterDx:  200, enterDy: -360 },
  { x: 710, y: 380, scale: 0.85, enterDx:  380, enterDy: -300 },
  // FRONT row — y in 440–455, x spread between ~230 and ~790
  { x: 230, y: 444, scale: 1,    enterDx: -380, enterDy: 0    },
  { x: 417, y: 450, scale: 1,    enterDx: -520, enterDy: 0    },
  { x: 603, y: 446, scale: 1,    enterDx:  520, enterDy: 0    },
  { x: 790, y: 452, scale: 1,    enterDx:  380, enterDy: 0    },
];
