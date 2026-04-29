import { useEffect, useState, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "./compositorRef";
import { cancelBgRemove } from "./bgRemoveController";

/** Cycle 6 — overlay shown while Remove.bg is processing an image
 * layer. Sailship-aesthetic lighthouse anchored bottom-right of the
 * layer bounds, sweeping a 120° cone of cream light across the dimmed
 * image. The lighthouse beam reads as "searching the dark sea for the
 * subject" — matches the editor-as-bridge-of-ship metaphor. */
export function BgRemoveOverlay() {
  const inProgress = useUiStore((s) => s.bgRemoveInProgress);
  const layerId = useUiStore((s) => s.bgRemoveLayerId);
  const layer = useDocStore((d) =>
    d.layers.find((l) => l.id === layerId && l.type === "image"),
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!inProgress) return;
    const compositor = getCurrentCompositor();
    if (!compositor) return;
    const bump = () => setTick((n) => n + 1);
    compositor.viewport.on("moved", bump);
    compositor.viewport.on("zoomed", bump);
    return () => {
      compositor.viewport.off("moved", bump);
      compositor.viewport.off("zoomed", bump);
    };
  }, [inProgress]);

  if (!inProgress || !layer || layer.type !== "image") return null;
  const compositor = getCurrentCompositor();
  if (!compositor) return null;

  const tl = compositor.canvasToScreen({ x: layer.x, y: layer.y });
  const br = compositor.canvasToScreen({
    x: layer.x + layer.width,
    y: layer.y + layer.height,
  });
  const width = Math.max(0, br.x - tl.x);
  const height = Math.max(0, br.y - tl.y);

  return (
    <div
      style={{ ...wrap, top: tl.y, left: tl.x, width, height }}
      data-testid="bg-remove-overlay"
    >
      <div style={dim} />
      <Lighthouse width={width} height={height} />
      <div style={hintWrap}>
        <span style={hint}>Scanning the waters…</span>
        <button
          type="button"
          style={cancelBtn}
          onClick={() => cancelBgRemove()}
          data-testid="bg-remove-overlay-cancel"
        >
          Cancel
        </button>
      </div>
      <style>{keyframes}</style>
    </div>
  );
}

/** Lighthouse + sweeping cone. Anchored bottom-right of the layer.
 * The cone is a separate SVG so its rotation pivots on the lamp center
 * without dragging the lighthouse silhouette with it. */
function Lighthouse({ width, height }: { width: number; height: number }) {
  // Slimmer, taller silhouette — proportions tuned for "navigation
  // seal" / minimalist line-art rather than illustrated children's-book
  // lighthouse. SVG box: 32 wide × 60 tall.
  const houseW = 32;
  const houseH = 60;
  if (width < 80 || height < 80) return null;
  const right = 18;
  const bottom = 18;
  // Lamp sits at SVG (16, 14). Position lamp anchor in screen coords.
  const lampX = right + houseW / 2;
  const lampY = bottom + houseH - 14;

  return (
    <>
      {/* Cone of light — origin at lamp, pivots around it. */}
      <div
        style={{
          ...coneWrap,
          right: lampX - 1,
          bottom: lampY - 1,
        }}
        aria-hidden="true"
      >
        <svg
          width={Math.max(width, height) * 1.4}
          height={Math.max(width, height) * 1.4}
          viewBox="-100 -100 200 200"
          style={cone}
        >
          <defs>
            <radialGradient id="tf-bg-cone" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0.35" />
              <stop offset="55%"  stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* 120° sector around 0° (straight up). */}
          <path
            d="M0 0 L-86.6 -50 A100 100 0 0 1 86.6 -50 Z"
            fill="url(#tf-bg-cone)"
          />
        </svg>
      </div>

      {/* Refined lighthouse silhouette — line-art only, no fill chrome.
          Slim tower, narrow taper, single railing platform, dome with
          a small finial. Stroke is cream; rendered open (no fill) so
          the dimmed image shows through and the silhouette reads as
          architecture, not a pasted icon. */}
      <svg
        width={houseW}
        height={houseH}
        viewBox="0 0 32 60"
        fill="none"
        stroke="var(--accent-cream, #F9F0E1)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          right,
          bottom,
          pointerEvents: "none",
          zIndex: 2,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
        }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="tf-bg-lamp" cx="16" cy="14" r="7" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0.95" />
            <stop offset="55%"  stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base footprint — narrow plinth */}
        <line x1="6" y1="58" x2="26" y2="58" />
        <line x1="9" y1="58" x2="9" y2="55" />
        <line x1="23" y1="58" x2="23" y2="55" />
        <line x1="9" y1="55" x2="23" y2="55" />

        {/* Tapered tower — gently narrows toward the gallery */}
        <line x1="11" y1="55" x2="13" y2="26" />
        <line x1="21" y1="55" x2="19" y2="26" />

        {/* Two horizontal banding lines for stripe detail (subtle, not
            painted bands — just hints at the classic candy-stripe). */}
        <line x1="11.5" y1="46" x2="20.5" y2="46" strokeWidth="0.6" opacity="0.55" />
        <line x1="12" y1="36" x2="20" y2="36" strokeWidth="0.6" opacity="0.55" />

        {/* Gallery / railing platform */}
        <line x1="10" y1="26" x2="22" y2="26" />
        <line x1="11" y1="23" x2="21" y2="23" />
        <line x1="10" y1="26" x2="11" y2="23" />
        <line x1="22" y1="26" x2="21" y2="23" />
        {/* Railing balusters */}
        <line x1="13" y1="23" x2="13" y2="26" strokeWidth="0.6" />
        <line x1="16" y1="23" x2="16" y2="26" strokeWidth="0.6" />
        <line x1="19" y1="23" x2="19" y2="26" strokeWidth="0.6" />

        {/* Lamp housing — narrow rectangle */}
        <rect x="13" y="13" width="6" height="10" rx="0.5" />

        {/* Dome — clean half-circle */}
        <path d="M12.5 13 A3.5 3.5 0 0 1 19.5 13" />

        {/* Finial / spire */}
        <line x1="16" y1="9.5" x2="16" y2="6.5" strokeWidth="0.8" />
        <circle cx="16" cy="6" r="0.6" fill="var(--accent-cream, #F9F0E1)" stroke="none" />

        {/* Glow halo behind the bulb — slow pulse to match beam cadence */}
        <circle cx="16" cy="14" r="7" fill="url(#tf-bg-lamp)" stroke="none">
          <animate attributeName="r" values="5.5;8;5.5" dur="4.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.85;1;0.85" dur="4.8s" repeatCount="indefinite" />
        </circle>
        {/* Bulb core */}
        <circle cx="16" cy="14" r="1.4" fill="var(--accent-cream, #F9F0E1)" stroke="none" />
      </svg>
    </>
  );
}

// Slow ease at the apex of each sweep so the beam pauses gently at the
// edges — feels like a real lighthouse motor catching, not a frantic
// scan line. 12s round trip = 6s each direction.
const keyframes = `
@keyframes tf-bg-sweep {
  0%   { transform: translate(50%, 50%) rotate(-90deg); }
  50%  { transform: translate(50%, 50%) rotate(180deg); }
  100% { transform: translate(50%, 50%) rotate(-90deg); }
}`;

const wrap: CSSProperties = {
  position: "absolute",
  pointerEvents: "none",
  overflow: "hidden",
  zIndex: 25,
};
const dim: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(10, 12, 20, 0.40)",
};
/** Cone wrapper anchors its (right, bottom) corner to the lamp. The
 * inner SVG is laid out so the cone's vertex sits at the SVG origin
 * (0,0); the wrapper's `transform: translate(50%, 50%)` shifts the
 * SVG so the origin lands exactly on (right, bottom). The rotation
 * sweeps the cone clockwise from "straight up" through "straight left"
 * and back over 3s. */
const coneWrap: CSSProperties = {
  position: "absolute",
  width: 0,
  height: 0,
  pointerEvents: "none",
  zIndex: 1,
  // mix-blend-mode: screen makes the cream cone read luminous over
  // the dimmed image without washing out the dark dim layer.
  mixBlendMode: "screen",
};
const cone: CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: 0,
  // The transform-origin sits at SVG (0,0), which we placed at the
  // bottom-right of the SVG box via the translate above.
  transformOrigin: "100% 100%",
  animation: "tf-bg-sweep 12s cubic-bezier(0.45, 0, 0.55, 1) infinite",
};
const hintWrap: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 8,
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  pointerEvents: "auto",
  zIndex: 3,
};
const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary, rgba(245,245,247,0.65))",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.04em",
  background: "rgba(10, 12, 20, 0.7)",
  padding: "3px 8px",
  borderRadius: 4,
};
const cancelBtn: CSSProperties = {
  fontSize: 11,
  padding: "3px 8px",
  background: "rgba(10, 12, 20, 0.7)",
  color: "var(--text-primary, #f9f0e1)",
  border: "1px solid var(--border-ghost, rgba(255,255,255,0.15))",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
