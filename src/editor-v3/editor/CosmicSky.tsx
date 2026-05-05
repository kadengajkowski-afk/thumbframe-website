/** Day 60 — animated cosmic sky scene for the editor empty state.
 *
 * Single SVG mounted as a fixed-position fullscreen layer behind the
 * editor grid (z-index: 0, above body bg, below the editor shell at
 * z-index: 1). pointer-events: none — cannot intercept clicks.
 *
 * Architecture:
 *   - Body bg keeps the cosmic horizon gradient (see tokens.css).
 *   - This SVG layers on top with: constellations (themed star
 *     groups), aurora ribbons (gradient-filled smooth paths),
 *     ambient drifting stars, occasional shooting stars.
 *   - All animation via CSS keyframes + SVG animateTransform — no
 *     JS rAF loop, no per-frame React re-renders.
 *   - GPU-accelerated transforms (translateX / opacity / scale).
 *
 * Layer order inside the SVG (back → front):
 *   1. Aurora ribbons (mid-sky, gradient-filled, blurred)
 *   2. Drifting star field — ambient stars that slowly translate
 *      horizontally as a group (parallax: distant slower).
 *   3. Themed constellations (compass / quill / anchor / sail /
 *      wheel) — brighter stars connected by faint cream lines.
 *   4. Shooting stars (occasional streaks, infinite-loop keyframes).
 *
 * Constellation positions are deterministic (hand-placed) so the
 * layout stays the same across renders.
 *
 * NEVER mounted inside canvasSurface or any editor-grid descendant
 * — Day 57 first attempt's mistake. Sibling of editor grid only. */

const VIEWBOX_W = 1920;
const VIEWBOX_H = 1080;

// Deterministic small-PRNG so the ambient star field is stable.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Star = { x: number; y: number; r: number; a: number };

function ambientStars(): Star[] {
  const rand = makeRng(0xC0FFEE);
  const stars: Star[] = [];
  // 180 ambient stars — varied size + alpha. Heavier in upper 60% so
  // the lower foreground wheel + railings stay visually clean.
  for (let i = 0; i < 180; i++) {
    const yBias = rand() < 0.75 ? rand() * 0.65 : rand();
    const sizeRand = rand();
    const r = sizeRand < 0.6 ? 0.8 : sizeRand < 0.9 ? 1.6 : 2.6;
    const a = sizeRand < 0.5 ? 0.30 + rand() * 0.20
            : sizeRand < 0.8 ? 0.50 + rand() * 0.20
            :                  0.70 + rand() * 0.20;
    stars.push({
      x: rand() * VIEWBOX_W,
      y: yBias * VIEWBOX_H,
      r,
      a,
    });
  }
  return stars;
}

// ── Constellation definitions ─────────────────────────────────────
// Each constellation is a list of star positions (relative coords)
// + a path connecting them. The lines pulse opacity on a stagger.

type Constellation = {
  name: string;
  cx: number; // group center x
  cy: number; // group center y
  stars: { x: number; y: number; r: number }[];
  // path string (relative to constellation center, NOT viewport)
  path: string;
  delay: number; // animation delay seconds
};

const CONSTELLATIONS: Constellation[] = [
  {
    // Compass — top-center: north pip + 4 cardinal points
    name: "compass",
    cx: 960, cy: 200,
    stars: [
      { x:  0, y: -60, r: 3.2 }, // N
      { x:  0, y:   0, r: 2.4 }, // hub
      { x: 60, y:   0, r: 2.8 }, // E
      { x:  0, y:  60, r: 2.4 }, // S
      { x:-60, y:   0, r: 2.8 }, // W
    ],
    path: "M0,-60 L0,60 M-60,0 L60,0",
    delay: 0,
  },
  {
    // Quill — upper-left: feathered curve + tip
    name: "quill",
    cx: 400, cy: 260,
    stars: [
      { x:-70, y:-50, r: 2.6 },
      { x:-40, y:-30, r: 2.4 },
      { x:-10, y: -8, r: 2.8 },
      { x: 20, y: 18, r: 3.2 },
      { x: 50, y: 42, r: 2.4 },
      { x: 65, y: 60, r: 2.0 },
      { x: 75, y: 75, r: 3.4 }, // tip
    ],
    path: "M-70,-50 Q-30,-20 20,18 Q55,50 75,75",
    delay: 3,
  },
  {
    // Anchor — upper-right: top ring + crossbar + curved hook
    name: "anchor",
    cx: 1500, cy: 240,
    stars: [
      { x:  0, y:-60, r: 2.8 }, // ring top
      { x:  0, y:-40, r: 2.0 }, // ring bottom
      { x:-30, y:-30, r: 2.4 }, // crossbar L
      { x: 30, y:-30, r: 2.4 }, // crossbar R
      { x:  0, y: 60, r: 2.8 }, // shaft bottom
      { x:-40, y: 40, r: 2.2 }, // hook L tip
      { x: 40, y: 40, r: 2.2 }, // hook R tip
    ],
    path: "M0,-60 L0,60 M-30,-30 L30,-30 M-40,40 Q-20,60 0,60 Q20,60 40,40",
    delay: 6,
  },
  {
    // Sail — mid-right: triangular billowing sail
    name: "sail",
    cx: 1620, cy: 540,
    stars: [
      { x:  0, y:-70, r: 3.0 }, // top
      { x: 60, y: 50, r: 2.4 }, // bottom-right (billow)
      { x:-50, y: 50, r: 2.4 }, // bottom-left
      { x:  0, y: 50, r: 2.0 }, // mast foot
    ],
    path: "M0,-70 Q40,0 60,50 Q0,30 -50,50 Q-25,-20 0,-70",
    delay: 9,
  },
  {
    // Wheel — mid-left: 8 outer points + hub
    name: "wheel",
    cx: 280, cy: 580,
    stars: (() => {
      const arr = [{ x: 0, y: 0, r: 2.4 }];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        arr.push({ x: Math.cos(a) * 60, y: Math.sin(a) * 60, r: 2.2 });
      }
      return arr;
    })(),
    path: (() => {
      let p = "";
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const x = Math.cos(a) * 60;
        const y = Math.sin(a) * 60;
        p += `M0,0 L${x.toFixed(1)},${y.toFixed(1)} `;
      }
      return p;
    })(),
    delay: 12,
  },
];

const CSS_KEYFRAMES = `
@keyframes cs-drift-slow {
  from { transform: translateX(0); }
  to   { transform: translateX(-${VIEWBOX_W}px); }
}
@keyframes cs-drift-fast {
  from { transform: translateX(0); }
  to   { transform: translateX(-${VIEWBOX_W}px); }
}
@keyframes cs-line-pulse {
  0%, 100% { opacity: 0.18; }
  50%      { opacity: 0.45; }
}
@keyframes cs-aurora-drift-1 {
  0%   { transform: translateX(-200px) scaleY(1); }
  50%  { transform: translateX(${VIEWBOX_W * 0.2}px) scaleY(1.05); }
  100% { transform: translateX(${VIEWBOX_W + 200}px) scaleY(1); }
}
@keyframes cs-aurora-drift-2 {
  0%   { transform: translateX(${VIEWBOX_W + 100}px) scaleY(1); }
  50%  { transform: translateX(${VIEWBOX_W * 0.4}px) scaleY(0.95); }
  100% { transform: translateX(-200px) scaleY(1); }
}
@keyframes cs-aurora-drift-3 {
  0%   { transform: translateX(${VIEWBOX_W * 0.5}px); opacity: 0.18; }
  50%  { transform: translateX(${VIEWBOX_W * 0.1}px); opacity: 0.28; }
  100% { transform: translateX(${VIEWBOX_W * 0.5}px); opacity: 0.18; }
}
@keyframes cs-horizon-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.78; }
}
@keyframes cs-shoot {
  0%   { transform: translate(0, 0); opacity: 0; }
  3%   { opacity: 1; }
  18%  { transform: translate(-340px, 220px); opacity: 0; }
  100% { transform: translate(-340px, 220px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .cs-drift, .cs-aurora, .cs-line, .cs-horizon, .cs-shoot {
    animation: none !important;
  }
}
`;

/** mode="empty" — full animated cosmic deck (Day 60 default).
 *  mode="editor" — calmer: half the stars, NO aurora, NO constellations,
 *  no shooting stars. Just slow drift + faint horizon. The user is
 *  WORKING; atmosphere stays a quiet backdrop. */
export function CosmicSky({ mode = "empty" }: { mode?: "empty" | "editor" }) {
  const stars = ambientStars();
  const isEditor = mode === "editor";

  return (
    <svg
      aria-hidden="true"
      data-alive="cosmic-sky"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Day 62 — paper-grain filter mimicking the landing's
         *  PainterlyPost (Kuwahara + outline + grain) without
         *  shipping Three.js shaders. SVG-only chain:
         *    - feTurbulence: fractal noise pattern, fine octaves
         *      give us paper texture.
         *    - feColorMatrix: shift the noise to warm cream/amber
         *      so it doesn't read as monochrome static.
         *    - feComposite in: composites grain ONTO the source so
         *      transparent areas stay transparent (no full-screen
         *      noise outside the painted shapes).
         *    - feBlend with the original for a "painted on
         *      paper" feel.
         * Applied to the aurora ribbons, where the smooth gradient
         * was the most obviously digital element. */}
        <filter id="cs-paper-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="7"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 0.92
                    0 0 0 0 0.78
                    0 0 0 0.45 0"
            result="warmGrain"
          />
          <feComposite in="warmGrain" in2="SourceAlpha" operator="in" result="maskedGrain" />
          <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" />
        </filter>
        {/* Body paper grain — covers the whole sky as a final overlay
         *  rect with multiply blend so the painterly texture sits on
         *  top of stars + horizon. Lower-frequency noise reads as
         *  paper fiber rather than fine static. */}
        <filter id="cs-sky-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="3"
            seed="13"
            result="paper"
          />
          <feColorMatrix
            in="paper"
            type="matrix"
            values="0 0 0 0 0.98
                    0 0 0 0 0.95
                    0 0 0 0 0.85
                    0 0 0 0.18 0"
          />
        </filter>

        {/* Aurora gradients — cream → amber → emerald → cream */}
        <linearGradient id="cs-aurora-g1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#fff4e0" stopOpacity="0" />
          <stop offset="35%" stopColor="#f97316" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#3afa9a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fff4e0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cs-aurora-g2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#fff4e0" stopOpacity="0" />
          <stop offset="40%" stopColor="#3afa9a" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#f97316" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff4e0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cs-aurora-g3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#fff4e0" stopOpacity="0" />
          <stop offset="50%" stopColor="#a050f0" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#fff4e0" stopOpacity="0" />
        </linearGradient>
        {/* Soft blur for aurora edges */}
        <filter id="cs-soft" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        {/* Star halo for the brightest constellation stars */}
        <filter id="cs-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        {/* Horizon breathing band — wide amber ellipse, blurred */}
        <radialGradient id="cs-horizon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#f97316" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{CSS_KEYFRAMES}</style>

      {/* ── Aurora ribbons (mid-sky 40-65%) — empty state only ────
       *  Day 62: chained the paper-grain filter on top of the
       *  soft-blur so the ribbons get a painted-on-watercolor-paper
       *  texture instead of a clean digital gradient. */}
      {!isEditor && (
      <g style={{ filter: "url(#cs-soft) url(#cs-paper-grain)", mixBlendMode: "screen" }}>
        <g
          className="cs-aurora"
          style={{
            animation: "cs-aurora-drift-1 90s linear infinite",
            opacity: 0.32,
          }}
        >
          <path
            d="M-300,520 Q400,420 900,500 T2200,460 L2200,580 Q1600,640 900,580 T-300,640 Z"
            fill="url(#cs-aurora-g1)"
          />
        </g>
        <g
          className="cs-aurora"
          style={{
            animation: "cs-aurora-drift-2 120s linear infinite",
            opacity: 0.28,
          }}
        >
          <path
            d="M-200,640 Q500,560 1100,620 T2200,600 L2200,720 Q1500,760 1000,720 T-200,760 Z"
            fill="url(#cs-aurora-g2)"
          />
        </g>
        <g
          className="cs-aurora"
          style={{ animation: "cs-aurora-drift-3 18s ease-in-out infinite" }}
        >
          <path
            d="M-100,460 Q700,400 1400,440 T2400,420 L2400,540 Q1500,580 700,540 T-100,580 Z"
            fill="url(#cs-aurora-g3)"
          />
        </g>
      </g>
      )}

      {/* ── Drifting ambient star field ──────────────────────────── */}
      {/* Two copies side-by-side for seamless wrap on translateX.
       *  Editor mode: half the stars + slower drift (180s vs 90s) +
       *  half opacity so the field reads as quiet backdrop, not show. */}
      <g
        className="cs-drift"
        style={{
          animation: isEditor
            ? "cs-drift-slow 180s linear infinite"
            : "cs-drift-slow 90s linear infinite",
          opacity: isEditor ? 0.55 : 1,
        }}
      >
        {[0, VIEWBOX_W].map((offsetX) => (
          <g key={offsetX} transform={`translate(${offsetX} 0)`}>
            {(isEditor ? stars.filter((_, i) => i % 2 === 0) : stars).map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill="#fff4e0"
                opacity={s.a}
              />
            ))}
          </g>
        ))}
      </g>

      {/* ── Themed constellations — empty state only ────────────── */}
      {/* Wrapped in a slow-drift group with a slightly slower speed
          than ambient stars (parallax depth: constellations are
          "further" so they appear to move slower). Editor mode keeps
          the sky quiet — no constellation lines. */}
      {!isEditor && (
      <g
        className="cs-drift"
        style={{ animation: "cs-drift-fast 140s linear infinite" }}
      >
        {[0, VIEWBOX_W].map((offsetX) => (
          <g key={offsetX} transform={`translate(${offsetX} 0)`}>
            {CONSTELLATIONS.map((c) => (
              <g key={c.name} transform={`translate(${c.cx} ${c.cy})`}>
                <path
                  d={c.path}
                  fill="none"
                  stroke="#fff4e0"
                  strokeWidth="1"
                  strokeLinecap="round"
                  className="cs-line"
                  style={{
                    animation: `cs-line-pulse 14s ease-in-out infinite ${c.delay}s`,
                  }}
                />
                {c.stars.map((s, i) => (
                  <g key={i}>
                    {/* Halo */}
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={s.r * 2.6}
                      fill="#fff4e0"
                      opacity="0.18"
                      filter="url(#cs-glow)"
                    />
                    {/* Core */}
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={s.r}
                      fill="#fff4e0"
                      opacity="0.85"
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>
        ))}
      </g>
      )}

      {/* ── Horizon breathing glow — wide amber ellipse low ──────
       *  Editor mode: dimmer + no breathing animation (steady glow). */}
      <g
        className="cs-horizon"
        style={{
          animation: isEditor
            ? undefined
            : "cs-horizon-breathe 9s ease-in-out infinite",
          opacity: isEditor ? 0.30 : 1,
          mixBlendMode: "screen",
        }}
      >
        <ellipse
          cx={VIEWBOX_W / 2}
          cy={VIEWBOX_H * 0.92}
          rx={VIEWBOX_W * 0.55}
          ry={VIEWBOX_H * 0.10}
          fill="url(#cs-horizon-glow)"
        />
      </g>

      {/* ── Shooting stars — empty state only ─────────────────── */}
      {!isEditor && (
      <g style={{ mixBlendMode: "screen" }}>
        <g
          className="cs-shoot"
          style={{
            transformOrigin: "1700px 180px",
            animation: "cs-shoot 36s ease-out infinite",
          }}
        >
          <line
            x1="1700" y1="180" x2="1740" y2="155"
            stroke="#fff4e0" strokeWidth="1.4" strokeLinecap="round"
            opacity="0.95"
          />
          <line
            x1="1740" y1="155" x2="1820" y2="120"
            stroke="#fff4e0" strokeWidth="0.7" strokeLinecap="round"
            opacity="0.5"
          />
        </g>
        <g
          className="cs-shoot"
          style={{
            transformOrigin: "1100px 320px",
            animation: "cs-shoot 54s ease-out infinite 21s",
          }}
        >
          <line
            x1="1100" y1="320" x2="1140" y2="295"
            stroke="#fff4e0" strokeWidth="1.4" strokeLinecap="round"
            opacity="0.95"
          />
          <line
            x1="1140" y1="295" x2="1220" y2="260"
            stroke="#fff4e0" strokeWidth="0.7" strokeLinecap="round"
            opacity="0.5"
          />
        </g>
      </g>
      )}

      {/* ── Final paper-grain overlay (Day 62) ─────────────────────
       *  A full-viewport rect filled with low-frequency warm noise,
       *  multiply-blended over the sky so every painted element
       *  picks up the paper-fiber texture. Empty state only —
       *  editor mode keeps the sky clean for working concentration.
       *  Heavy SVG filter on a fullscreen rect can be a perf hit on
       *  weaker GPUs; opacity stays low so it's a paper-feel hint,
       *  not a full Kuwahara replacement. */}
      {!isEditor && (
        <rect
          x="0"
          y="0"
          width={VIEWBOX_W}
          height={VIEWBOX_H}
          fill="#fff4e0"
          opacity="0.18"
          style={{ filter: "url(#cs-sky-grain)", mixBlendMode: "multiply" }}
        />
      )}
    </svg>
  );
}
