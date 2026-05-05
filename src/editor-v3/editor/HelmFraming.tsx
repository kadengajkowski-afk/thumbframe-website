/** Day 61-fix — foreground deck without floating logos.
 *
 * Day 62 placed two ship-logo PNGs in the empty state scene; per
 * Kaden's review they competed with the upload card and didn't
 * belong in the cosmic scene at all (logo lives in TopBar only).
 *
 * Day 61-fix scope: keep the painterly hull strip + warm lantern
 * glow, drop the logo images. The hull strip alone reads as "you're
 * standing on a ship's deck" without dominating the upload card.
 *
 * pointer-events: none, position: fixed, z-index: 0. */

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
          boxShadow: "inset 0 1px 0 0 rgba(200, 132, 62, 0.35)",
        }}
      />

      {/* ── Lantern glow — soft warm amber pool on the deck ───── */}
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
    </div>
  );
}
