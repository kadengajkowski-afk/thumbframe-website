/** Day 62 — foreground ship that actually matches the logo.
 *
 * Day 60 painted brass-orange wireframe wheel + railings — they
 * read as digital illustration, not the painterly cream-amber sail
 * + dark brown-black hull + warm amber lantern + paint splatter of
 * /public/brand/ship-logo-final.png.
 *
 * Day 62 fix: drop the wireframe entirely. Use the actual logo PNG
 * as the painterly ship element, scaled and positioned so it reads
 * as "you're standing on this ship" without dominating. Add a deep
 * brown hull strip at the very bottom (matches the logo's dark
 * silhouette) and a soft amber lantern glow on the deck.
 *
 * No SVG primitives competing with the painted brand asset. The
 * logo IS the painted style; reuse it instead of redrawing it.
 *
 * pointer-events: none, position: fixed, z-index: 0. Cannot touch
 * the editor mount tree. */

const VIEWBOX_W = 1920;
const VIEWBOX_H = 1080;

export function HelmFraming() {
  return (
    <div
      aria-hidden="true"
      data-alive="helm-framing"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Hull strip — deep brown silhouette at the very bottom ─ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 80,
          background:
            "linear-gradient(to top, " +
            "#0a0500 0%, " +
            "#1a0d04 30%, " +
            "rgba(58, 40, 24, 0.85) 65%, " +
            "rgba(58, 40, 24, 0.50) 90%, " +
            "transparent 100%)",
          // Subtle wood-grain hint via a cream noise overlay
          boxShadow: "inset 0 1px 0 0 rgba(200, 132, 62, 0.35)",
        }}
      />

      {/* ── Lantern glow — soft warm amber pool on the "deck" ──── */}
      <div
        style={{
          position: "absolute",
          left: "12%",
          bottom: 60,
          width: 320,
          height: 120,
          background:
            "radial-gradient(ellipse at center, " +
            "rgba(200, 132, 62, 0.40) 0%, " +
            "rgba(200, 132, 62, 0.15) 40%, " +
            "transparent 75%)",
          filter: "blur(4px)",
          mixBlendMode: "screen",
          // Subtle flicker so the lantern feels alive without being
          // distracting. CSS keyframes only, no JS loop.
          animation: "tf-lantern-flicker 6s ease-in-out infinite",
        }}
      />
      <style>{`
@keyframes tf-lantern-flicker {
  0%, 100% { opacity: 1; }
  35%      { opacity: 0.78; }
  55%      { opacity: 1.05; }
  72%      { opacity: 0.85; }
}
@media (prefers-reduced-motion: reduce) {
  [data-alive="helm-framing"] * { animation: none !important; }
}
      `}</style>

      {/* ── The actual ship logo as the painterly foreground ──── */}
      {/* Positioned bottom-left, scaled so it sits roughly behind
          the empty-state card. Soft drop shadow + slight rotation
          so it reads as "you're standing here" without being a
          centered focal that competes with the upload card. */}
      <img
        src="/brand/ship-logo-final.png"
        alt=""
        style={{
          position: "absolute",
          left: "8%",
          bottom: "10%",
          width: "min(420px, 28vw)",
          opacity: 0.72,
          transform: "rotate(-4deg)",
          filter: "drop-shadow(0 12px 24px rgba(10, 5, 0, 0.55))",
          mixBlendMode: "normal",
        }}
      />

      {/* Mirrored ship hint at the right — same logo, flipped, at
          lower opacity. Suggests the ship continues across the
          viewport (the user is standing in the middle). */}
      <img
        src="/brand/ship-logo-final.png"
        alt=""
        style={{
          position: "absolute",
          right: "6%",
          bottom: "4%",
          width: "min(280px, 18vw)",
          opacity: 0.40,
          transform: "scaleX(-1) rotate(3deg)",
          filter: "drop-shadow(0 8px 16px rgba(10, 5, 0, 0.45))",
          mixBlendMode: "normal",
        }}
      />

      {/* Suppress unused-VIEWBOX warning — kept for future SVG layers. */}
      <span style={{ display: "none" }}>{VIEWBOX_W}x{VIEWBOX_H}</span>
    </div>
  );
}
