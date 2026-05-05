import { type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";

/** Day 65b — ThumbFriend floating bubble.
 *
 *  Always-visible floating button bottom-right that opens the
 *  existing ThumbFriendPanel (mounted in EditorShell's right wall
 *  via the right-slot conditional). Click toggles
 *  uiStore.thumbfriendPanelOpen.
 *
 *  Visual: 56×56 brass-rimmed circle with the painterly ship logo
 *  inside. Soft bob animation (±3px translateY, 4s ease-in-out
 *  loop) so it feels alive without being distracting. Subtle
 *  amber glow on hover.
 *
 *  position: fixed, bottom-right, z-index var(--z-overlay).
 *  Hidden when the ThumbFriend panel is already open (the panel
 *  itself is the visible state). */

const BUBBLE_SIZE = 56;

export function ThumbFriendBubble() {
  const open = useUiStore((s) => s.thumbfriendPanelOpen);
  const toggle = () => {
    const ui = useUiStore.getState();
    ui.setThumbfriendPanelOpen(!ui.thumbfriendPanelOpen);
  };

  // When the panel is open the bubble would be redundant. Hide it.
  if (open) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open ThumbFriend chat"
      data-testid="thumbfriend-bubble"
      style={wrap}
    >
      <span style={inner}>
        <img
          src="/brand/ship-logo-final.png"
          alt=""
          aria-hidden="true"
          width={42}
          height={42}
          style={{
            objectFit: "contain",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
          }}
        />
      </span>
      <style>{KEYFRAMES}</style>
    </button>
  );
}

const KEYFRAMES = `
@keyframes tf-bubble-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="thumbfriend-bubble"] { animation: none !important; }
  [data-testid="thumbfriend-bubble"] span { animation: none !important; }
}
`;

const wrap: CSSProperties = {
  position: "fixed",
  bottom: 60,    // Sit above the bottom wall (38px) + a margin.
  right: 60,     // Sit clear of the layers tab on right edge.
  zIndex: 30,    // var(--z-overlay)
  width: BUBBLE_SIZE,
  height: BUBBLE_SIZE,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  borderRadius: "50%",
  outline: "none",
};

const inner: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background:
    "radial-gradient(ellipse at 30% 30%, rgba(245, 230, 200, 0.18), rgba(58, 40, 24, 0.85) 70%)",
  border: "2px solid var(--brass)",
  boxShadow:
    "inset 0 1px 0 0 rgba(255, 244, 224, 0.18), " +
    "0 6px 18px -4px rgba(0, 0, 0, 0.55), " +
    "0 0 0 2px rgba(184, 134, 75, 0.08)",
  animation: "tf-bubble-bob 4s ease-in-out infinite",
};
