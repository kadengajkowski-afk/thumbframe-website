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
  const houseW = 44;
  const houseH = 50;
  // Lamp sits ~6px from the top of the lighthouse silhouette in our
  // SVG. The cone rotates around that lamp. Anchor lighthouse to
  // bottom-right with ~16px inset; if the layer is tiny, gracefully
  // shrink (no overlay clutter on thumbnails).
  if (width < 80 || height < 80) return null;
  const right = 16;
  const bottom = 16;
  const lampX = right + houseW / 2;
  const lampY = bottom + houseH - 6;

  return (
    <>
      {/* Cone of light — origin at lamp, pivots around it. The cone's
          tip sits at the lamp; the cone fans down-left across the
          image. We rotate the cone container, not the cone path. */}
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
          {/* 120° sector: from -60° to +60° around 0° (straight up).
              The wrapper rotates this whole shape around (0,0). */}
          <path
            d="M0 0 L-86.6 -50 A100 100 0 0 1 86.6 -50 Z"
            fill="url(#tf-bg-cone)"
          />
        </svg>
      </div>

      {/* Lighthouse silhouette + glowing lamp. */}
      <svg
        width={houseW}
        height={houseH + 8}
        viewBox="0 0 44 58"
        style={{
          position: "absolute",
          right,
          bottom,
          pointerEvents: "none",
          zIndex: 2,
        }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="tf-bg-lamp" cx="22" cy="8" r="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="1" />
            <stop offset="60%"  stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-cream, #F9F0E1)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Base — wide trapezoid */}
        <path
          d="M6 56 L10 40 L34 40 L38 56 Z"
          fill="rgba(10,12,20,0.85)"
          stroke="var(--accent-cream, #F9F0E1)"
          strokeWidth="1.2"
        />
        {/* Mid section */}
        <path
          d="M12 40 L14 22 L30 22 L32 40 Z"
          fill="rgba(10,12,20,0.85)"
          stroke="var(--accent-cream, #F9F0E1)"
          strokeWidth="1.2"
        />
        {/* Platform under the lamp */}
        <rect
          x="11" y="20" width="22" height="3"
          fill="rgba(10,12,20,0.85)"
          stroke="var(--accent-cream, #F9F0E1)"
          strokeWidth="1.2"
        />
        {/* Lamp housing */}
        <path
          d="M15 20 L15 12 L29 12 L29 20 Z"
          fill="rgba(10,12,20,0.85)"
          stroke="var(--accent-cream, #F9F0E1)"
          strokeWidth="1.2"
        />
        {/* Dome / roof */}
        <path
          d="M14 12 L22 4 L30 12 Z"
          fill="rgba(10,12,20,0.85)"
          stroke="var(--accent-cream, #F9F0E1)"
          strokeWidth="1.2"
        />
        {/* Glow halo behind the bulb */}
        <circle cx="22" cy="8" r="9" fill="url(#tf-bg-lamp)">
          <animate attributeName="r" values="7;10;7" dur="2.4s" repeatCount="indefinite" />
        </circle>
        {/* Bulb */}
        <circle
          cx="22" cy="8" r="2"
          fill="var(--accent-cream, #F9F0E1)"
        />
      </svg>
    </>
  );
}

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
  animation: "tf-bg-sweep 3s ease-in-out infinite",
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
