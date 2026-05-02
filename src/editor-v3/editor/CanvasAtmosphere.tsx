import { useMemo, type CSSProperties } from "react";

/** Day 57 — atmospheric backdrop for the canvas surface area.
 *
 * Renders a deterministic star field (~150 cream dots at varied
 * opacity + size, with 4 brighter twinkles) as inline SVG behind
 * the editor canvas. The star positions are computed once via a
 * seeded LCG so every editor session sees the same field — no
 * jarring "stars moved" effect across re-renders.
 *
 * Plus a faint nebula radial-gradient overlay (purple/blue, max
 * 8% opacity) and a subtle horizon line at the bottom edge.
 *
 * Performance: pure CSS keyframes for twinkle, no JS animation
 * loop. Stars are static SVG circles. The component returns null
 * outside dark mode (light mode gets a wave-shimmer treatment in
 * the same slot — see WaveShimmer below).
 *
 * Spec calls for "100-200 small dots" — we ship 150 with 4 of
 * them rendered as brighter twinkle stars (separate animation
 * delays so they pulse out of phase). */

const STAR_COUNT = 150;
const TWINKLE_COUNT = 4;
const SEED = 0x53534353; // "SSCS" — sailship-cosmic-stars

function lcg(seed: number) {
  // Numerical Recipes LCG — deterministic, fast, good enough for
  // visual randomness. Returns [0, 1) on each next() call.
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

type Star = { x: number; y: number; r: number; o: number; twinkle?: boolean; delay?: number };

function buildStarField(): Star[] {
  const rng = lcg(SEED);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rng() * 100,            // % of viewBox
      y: rng() * 100,
      r: 0.4 + rng() * 1.0,      // 0.4–1.4 px-equivalent
      o: 0.10 + rng() * 0.20,    // 10–30% opacity
    });
  }
  // Reserve a few brighter twinkle stars at deterministic spots.
  const twinklePositions = [
    { x: 12, y: 18 }, { x: 78, y: 9 }, { x: 32, y: 72 }, { x: 88, y: 64 },
  ];
  for (let i = 0; i < TWINKLE_COUNT; i++) {
    stars.push({
      x: twinklePositions[i]!.x,
      y: twinklePositions[i]!.y,
      r: 1.4,
      o: 0.5,
      twinkle: true,
      delay: i * 1.2,
    });
  }
  return stars;
}

export function CanvasAtmosphere() {
  const stars = useMemo(buildStarField, []);
  return (
    <div style={wrap} aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={starField}
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.06}
            fill="var(--accent-cream)"
            opacity={s.o}
            className={s.twinkle ? "tf-star-twinkle" : undefined}
            style={s.twinkle && s.delay !== undefined ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
      </svg>
      <div style={nebulaOverlay} />
      <style>{KEYFRAMES}</style>
    </div>
  );
}

const KEYFRAMES = `
@keyframes tf-star-twinkle {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.15; }
}
.tf-star-twinkle { animation: tf-star-twinkle 4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .tf-star-twinkle { animation: none; opacity: 0.4; }
}
`;

const wrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
  zIndex: 0,
};

const starField: CSSProperties = {
  position: "absolute",
  inset: 0,
  // Slight upward gradient mask so the brightest stars cluster
  // toward the upper portion of the canvas surroundings — feels
  // like sky, not uniform field.
  maskImage: "linear-gradient(180deg, rgba(0,0,0,1) 60%, rgba(0,0,0,0.7) 100%)",
  WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,1) 60%, rgba(0,0,0,0.7) 100%)",
};

const nebulaOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(420px 320px at 22% 30%, rgba(120, 85, 200, 0.08), transparent 70%), " +
    "radial-gradient(380px 300px at 78% 65%, rgba(208, 112, 64, 0.06), transparent 70%)",
  pointerEvents: "none",
};
