/** Day 58 retry — "Captain at the helm" framing layer.
 *
 * Suggests the ship's deck around the editor without taking over the
 * viewport. Three subtle SVG elements:
 *   - Ship's wheel silhouette at bottom-center (cream stroke, ~12%
 *     opacity), rotated slightly so it reads as a real wheel under
 *     the user's hands.
 *   - Brass railing pair at the very bottom-left and bottom-right —
 *     thin amber strokes hinting at the deck rail.
 *   - Faint horizon line accent crossing the viewport at ~70% down,
 *     where the body bg's amber band peaks.
 *
 * Architecture:
 *   - position: fixed, inset: 0
 *   - z-index: 0 (between body bg and editor grid which is z-index:1)
 *   - pointer-events: none (cannot intercept any click)
 *   - aria-hidden so screen readers ignore it
 *   - SVG primitives only — no canvas, no extra deps
 *
 * Cannot touch CompositorHost / Pixi mount / editor grid layout. */

export function HelmFraming() {
  return (
    <svg
      aria-hidden="true"
      data-alive="helm-framing"
      viewBox="0 0 1920 1080"
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
      {/* Faint horizon glow — sits exactly where the body bg's amber
          band peaks. Helps tie the framing to the atmosphere. */}
      <line
        x1="0" y1="756" x2="1920" y2="756"
        stroke="rgba(255, 244, 224, 0.10)"
        strokeWidth="1"
      />

      {/* Brass railing — left, foreshortened toward bottom. */}
      <g stroke="rgba(249, 115, 22, 0.28)" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="0"   y1="980" x2="220" y2="1080" />
        <line x1="0"   y1="940" x2="280" y2="1080" />
        {/* Vertical balusters */}
        <line x1="60"  y1="998" x2="60"  y2="1080" />
        <line x1="120" y1="1018" x2="120" y2="1080" />
        <line x1="180" y1="1040" x2="180" y2="1080" />
      </g>

      {/* Brass railing — right, mirrored. */}
      <g stroke="rgba(249, 115, 22, 0.28)" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="1920" y1="980" x2="1700" y2="1080" />
        <line x1="1920" y1="940" x2="1640" y2="1080" />
        <line x1="1860" y1="998" x2="1860" y2="1080" />
        <line x1="1800" y1="1018" x2="1800" y2="1080" />
        <line x1="1740" y1="1040" x2="1740" y2="1080" />
      </g>

      {/* Ship's wheel — bottom-center, faded so it reads as foreground
          but doesn't fight with the canvas above. Eight spokes, outer
          rim, inner hub. Composed from primitives so it scales cleanly. */}
      <g
        transform="translate(960 1140) rotate(-7)"
        stroke="rgba(255, 244, 224, 0.14)"
        strokeWidth="3"
        fill="none"
      >
        {/* Outer rim */}
        <circle cx="0" cy="0" r="180" />
        {/* Spoke handles — small bumps on the rim */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x = Math.cos(r) * 200;
          const y = Math.sin(r) * 200;
          return <circle key={deg} cx={x} cy={y} r="6" fill="rgba(249, 115, 22, 0.22)" stroke="none" />;
        })}
        {/* Inner ring */}
        <circle cx="0" cy="0" r="50" />
        {/* Spokes */}
        {[0, 45, 90, 135].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x1 = Math.cos(r) * 50;
          const y1 = Math.sin(r) * 50;
          const x2 = Math.cos(r) * 180;
          const y2 = Math.sin(r) * 180;
          const x3 = Math.cos(r + Math.PI) * 50;
          const y3 = Math.sin(r + Math.PI) * 50;
          const x4 = Math.cos(r + Math.PI) * 180;
          const y4 = Math.sin(r + Math.PI) * 180;
          return (
            <g key={deg}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <line x1={x3} y1={y3} x2={x4} y2={y4} />
            </g>
          );
        })}
        {/* Center hub */}
        <circle cx="0" cy="0" r="14" fill="rgba(249, 115, 22, 0.32)" stroke="none" />
      </g>
    </svg>
  );
}
