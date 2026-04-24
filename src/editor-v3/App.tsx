import { useEffect } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TopBar } from "@/editor/panels/TopBar";
import { LayerPanel } from "@/editor/panels/LayerPanel";
import { ContextPanel } from "@/editor/panels/ContextPanel";
import { ShipComingAlive } from "@/editor/transitions/ShipComingAlive";
import { EmptyState } from "@/editor/EmptyState";
import { DropZone } from "@/editor/DropZone";
import { useDropTarget } from "@/editor/useDropTarget";
import { installHotkeys } from "@/editor/hotkeys";
import { ToastHost } from "@/toasts/Toast";

/** Cycle 1 shell: empty state until hasEntered, then the editor grid.
 * The ShipComingAlive wrapper owns the first-visit transition. */
export function App() {
  const hasEntered = useUiStore((s) => s.hasEntered);
  const dragActive = useDropTarget();

  useEffect(() => installHotkeys(), []);

  return (
    <div style={shell}>
      <Nebula />
      <ShipComingAlive
        hasEntered={hasEntered}
        empty={<EmptyState />}
        editor={<EditorShell />}
      />
      {dragActive && <DropZone />}
      <ToastHost />
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

const editorGrid: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateRows: "48px 1fr 200px",
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
