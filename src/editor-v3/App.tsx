import { useEffect } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TopBar } from "@/editor/panels/TopBar";
import { LayerPanel } from "@/editor/panels/LayerPanel";
import { ContextPanel } from "@/editor/panels/ContextPanel";
import { ShipComingAlive } from "@/editor/transitions/ShipComingAlive";
import { installHotkeys } from "@/editor/hotkeys";

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);

  useEffect(() => installHotkeys(), []);

  return (
    <div style={shell}>
      <Nebula />
      <ShipComingAlive
        hasEntered={hasEntered}
        empty={<EmptyState />}
        editor={<EditorShell />}
      />
    </div>
  );
}

function EmptyState() {
  const setHasEntered = useUiStore((s) => s.setHasEntered);
  return (
    <div style={emptyWrap}>
      <div style={ghostFrame} aria-hidden="true">
        <div style={ghostInner} />
      </div>
      <div style={emptyCopy}>
        <h1 style={h1}>Upload to set sail</h1>
        <button
          type="button"
          onClick={() => setHasEntered(true)}
          style={startBlankBtn}
        >
          or start blank →
        </button>
      </div>
    </div>
  );
}

function EditorShell() {
  return (
    <div style={editorGrid}>
      <TopBar />
      <div style={editorRow}>
        <aside
          style={leftRail}
          aria-label="Tool palette placeholder"
          data-alive="leftrail"
        >
          <span style={leftRailHint} aria-hidden="true">
            Tools arriving Cycle 1 Day 5
          </span>
        </aside>
        <main style={canvasSurface} data-alive="canvas">
          <CompositorHost />
        </main>
        <ContextPanel />
      </div>
      <LayerPanel />
    </div>
  );
}

function Nebula() {
  return <div style={nebula} aria-hidden="true" />;
}

// ── styles ──────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-space-1)",
  overflow: "hidden",
};

const nebula: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(1100px 700px at 18% 22%, rgba(96, 56, 180, 0.28), transparent 70%), " +
    "radial-gradient(900px 620px at 82% 78%, rgba(208, 112, 64, 0.18), transparent 70%), " +
    "radial-gradient(600px 420px at 50% 50%, rgba(120, 90, 200, 0.10), transparent 80%), " +
    "var(--bg-space-1)",
  pointerEvents: "none",
  zIndex: 0,
};

const emptyWrap: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 36,
};

const ghostFrame: React.CSSProperties = {
  width: "min(1152px, 80vw)",
  aspectRatio: "16 / 9",
  border: "1px dashed var(--ghost-stroke)",
  background: "var(--ghost-fill)",
  borderRadius: 10,
  position: "relative",
  boxShadow: "0 0 80px rgba(249, 240, 225, 0.04) inset",
};

const ghostInner: React.CSSProperties = {
  position: "absolute",
  inset: 18,
  border: "1px dashed rgba(249, 240, 225, 0.06)",
  borderRadius: 6,
};

const emptyCopy: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const h1: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.01em",
  color: "var(--accent-cream)",
  margin: 0,
};

const startBlankBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-2)",
  fontSize: 13,
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: "4px 8px",
  transition: "color var(--motion-fast) var(--ease-out)",
};

const editorGrid: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateRows: "48px 1fr 160px",
};

const editorRow: React.CSSProperties = {
  display: "flex",
  minHeight: 0,
};

const leftRail: React.CSSProperties = {
  width: 56,
  background: "var(--bg-space-1)",
  borderRight: "1px solid var(--border-ghost)",
  position: "relative",
  overflow: "hidden",
};

const leftRailHint: React.CSSProperties = {
  position: "absolute",
  top: 120,
  left: "50%",
  transform: "translateX(-50%) rotate(-90deg)",
  transformOrigin: "center",
  whiteSpace: "nowrap",
  color: "var(--text-tertiary)",
  opacity: 0.5,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  pointerEvents: "none",
};

const canvasSurface: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--canvas-surface-dark)",
  overflow: "hidden",
};
