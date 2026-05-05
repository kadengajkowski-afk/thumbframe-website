/** Day 60 — repainted helm framing.
 *
 * Day 58 / 59 used wireframe lines for the wheel + railings — read
 * as blueprint. Day 60 repaints with FILLED shapes:
 *   - Wood-toned deck strip at the very bottom (~5% height).
 *   - Painted brass railings on left and right with rounded tops.
 *   - Filled ship's wheel at bottom-center with brass rim, wood
 *     grain hint on the spokes, soft drop shadow.
 *
 * All cream/amber strokes use opacity to keep the foreground
 * supporting (not competing with) the cosmic sky. SVG primitives;
 * no extra deps. position:fixed inset:0 z-index:1 pointer-events:none.
 *
 * Sits ABOVE CosmicSky (z-index: 0) and BELOW the editor grid
 * (z-index: 1 explicit). The editor grid wraps with its own
 * z-index that starts higher in the stacking context. */

const VIEWBOX_W = 1920;
const VIEWBOX_H = 1080;

export function HelmFraming() {
  return (
    <svg
      aria-hidden="true"
      data-alive="helm-framing"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMax slice"
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
        {/* Brass rail gradient — warm amber shading vertical */}
        <linearGradient id="hf-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ffb070" stopOpacity="0.85" />
          <stop offset="50%"  stopColor="#f97316" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#9c4612" stopOpacity="0.50" />
        </linearGradient>
        {/* Wood deck gradient */}
        <linearGradient id="hf-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3a2418" stopOpacity="0.95" />
          <stop offset="50%"  stopColor="#2a1810" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#180c08" stopOpacity="1" />
        </linearGradient>
        {/* Wheel rim — brass-amber radial */}
        <radialGradient id="hf-wheel-rim" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="80%" stopColor="#f97316" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#9c4612" stopOpacity="0.35" />
        </radialGradient>
        {/* Wheel hub — warm amber */}
        <radialGradient id="hf-wheel-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffd1a0" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#f97316" stopOpacity="0.70" />
          <stop offset="100%" stopColor="#9c4612" stopOpacity="0.40" />
        </radialGradient>
        {/* Soft drop shadow for the wheel */}
        <filter id="hf-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ── Wooden deck strip — bottom ~6% of viewport ──────────── */}
      <g opacity="0.85">
        <rect
          x="0"
          y={VIEWBOX_H - 70}
          width={VIEWBOX_W}
          height="70"
          fill="url(#hf-wood)"
        />
        {/* Plank seams — warm-dark hairlines */}
        {[0, 240, 480, 720, 960, 1200, 1440, 1680].map((x) => (
          <line
            key={x}
            x1={x}
            y1={VIEWBOX_H - 70}
            x2={x + 30}
            y2={VIEWBOX_H}
            stroke="#0a0500"
            strokeWidth="2"
            opacity="0.6"
          />
        ))}
        {/* Brass nail-head highlights */}
        {[120, 360, 600, 840, 1080, 1320, 1560, 1800].map((x) => (
          <circle
            key={x}
            cx={x}
            cy={VIEWBOX_H - 35}
            r="2.5"
            fill="#f97316"
            opacity="0.75"
          />
        ))}
      </g>

      {/* ── Brass railing — LEFT ────────────────────────────────── */}
      <g opacity="0.72">
        {/* Top rail (curving inward toward the bottom) */}
        <path
          d="M0,940 Q120,990 220,1010 L220,1015 Q120,995 0,945 Z"
          fill="url(#hf-brass)"
        />
        {/* Vertical balusters with rounded brass tops */}
        {[40, 100, 160].map((x, i) => {
          const top = 990 + i * 8;
          return (
            <g key={x}>
              <rect
                x={x - 4}
                y={top}
                width="8"
                height={VIEWBOX_H - top}
                fill="url(#hf-brass)"
              />
              <circle cx={x} cy={top} r="6" fill="url(#hf-wheel-hub)" />
            </g>
          );
        })}
      </g>

      {/* ── Brass railing — RIGHT (mirrored) ────────────────────── */}
      <g opacity="0.72">
        <path
          d={`M${VIEWBOX_W},940 Q${VIEWBOX_W - 120},990 ${VIEWBOX_W - 220},1010 L${VIEWBOX_W - 220},1015 Q${VIEWBOX_W - 120},995 ${VIEWBOX_W},945 Z`}
          fill="url(#hf-brass)"
        />
        {[VIEWBOX_W - 40, VIEWBOX_W - 100, VIEWBOX_W - 160].map((x, i) => {
          const top = 990 + i * 8;
          return (
            <g key={x}>
              <rect
                x={x - 4}
                y={top}
                width="8"
                height={VIEWBOX_H - top}
                fill="url(#hf-brass)"
              />
              <circle cx={x} cy={top} r="6" fill="url(#hf-wheel-hub)" />
            </g>
          );
        })}
      </g>

      {/* ── Ship's wheel — bottom-center ────────────────────────── */}
      {/* Drop shadow first, then the wheel itself stacked over it. */}
      <g opacity="0.50">
        <ellipse
          cx={VIEWBOX_W / 2}
          cy={VIEWBOX_H - 30}
          rx="240"
          ry="40"
          fill="#000"
          opacity="0.55"
          filter="url(#hf-shadow)"
        />
      </g>
      <g
        transform={`translate(${VIEWBOX_W / 2} ${VIEWBOX_H + 60}) rotate(-6)`}
        opacity="0.62"
      >
        {/* Outer rim — thick painted ring */}
        <circle
          cx="0"
          cy="0"
          r="220"
          fill="none"
          stroke="url(#hf-brass)"
          strokeWidth="14"
        />
        {/* Inner rim ghost */}
        <circle
          cx="0"
          cy="0"
          r="206"
          fill="none"
          stroke="#9c4612"
          strokeWidth="2"
          opacity="0.5"
        />
        {/* Spoke handles — bumps on the rim */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          const x = Math.cos(a) * 230;
          const y = Math.sin(a) * 230;
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="8"
              ry="14"
              fill="url(#hf-wheel-hub)"
              transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
            />
          );
        })}
        {/* Spokes — wood-toned painted bars from hub to rim */}
        {Array.from({ length: 4 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          const x1 = Math.cos(a) * 50;
          const y1 = Math.sin(a) * 50;
          const x2 = Math.cos(a) * 212;
          const y2 = Math.sin(a) * 212;
          const x3 = Math.cos(a + Math.PI) * 50;
          const y3 = Math.sin(a + Math.PI) * 50;
          const x4 = Math.cos(a + Math.PI) * 212;
          const y4 = Math.sin(a + Math.PI) * 212;
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#9c4612"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Wood-grain hint — thin streak */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#ffb070"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
              <line
                x1={x3} y1={y3} x2={x4} y2={y4}
                stroke="#9c4612"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.85"
              />
              <line
                x1={x3} y1={y3} x2={x4} y2={y4}
                stroke="#ffb070"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>
          );
        })}
        {/* Hub — brass cap */}
        <circle cx="0" cy="0" r="48" fill="url(#hf-wheel-hub)" />
        <circle
          cx="0"
          cy="0"
          r="48"
          fill="none"
          stroke="#9c4612"
          strokeWidth="2"
          opacity="0.7"
        />
        {/* Center pin */}
        <circle cx="0" cy="0" r="10" fill="#fff4e0" opacity="0.55" />
      </g>
    </svg>
  );
}
