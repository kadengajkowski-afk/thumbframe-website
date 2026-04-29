import { useEffect, useState, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "./compositorRef";
import { cancelBgRemove } from "./bgRemoveController";

/** Cycle 6 — full-canvas overlay shown while Remove.bg is processing a
 * layer. A scanning line sweeps across the image (top → bottom, 3s
 * loop), the layer dims, and a small "This may take a moment…" hint
 * sits below with a Cancel button. Mounted in App.tsx alongside
 * TextEditor so it tracks the canvas surface, not the side panels. */
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
      <div style={scanLine} />
      <div style={hintWrap}>
        <span style={hint}>This may take a moment…</span>
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

const keyframes = `
@keyframes tf-bg-scan {
  0%   { transform: translateY(0%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
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
  background: "rgba(10, 12, 20, 0.35)",
};
const scanLine: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  height: 2,
  background:
    "linear-gradient(90deg, transparent, var(--accent-orange, #f97316), transparent)",
  boxShadow: "0 0 12px var(--accent-orange, #f97316)",
  animation: "tf-bg-scan 3s linear infinite",
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
