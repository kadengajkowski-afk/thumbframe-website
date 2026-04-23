import { useState } from "react";
import { CompositorHost } from "@/editor/CompositorHost";

/** Cycle 1 Day 1 shell: sailship empty state in a nebula. No tool palette yet. */
export function App() {
  const [started, setStarted] = useState(false);

  return (
    <div style={shell}>
      <Nebula />

      {!started ? (
        <EmptyState onStartBlank={() => setStarted(true)} />
      ) : (
        <div style={canvasStage}>
          <CompositorHost />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onStartBlank }: { onStartBlank: () => void }) {
  return (
    <div style={emptyWrap}>
      <GhostlyCanvas />
      <div style={emptyCopy}>
        <h1 style={h1}>Upload to set sail</h1>
        <button type="button" onClick={onStartBlank} style={startBlankBtn}>
          or start blank →
        </button>
      </div>
    </div>
  );
}

/** Nebula background — layered radial gradients, static for Day 1. */
function Nebula() {
  return <div style={nebula} aria-hidden="true" />;
}

/** Ghostly 1280×720 frame. Scales down on small viewports via max-width. */
function GhostlyCanvas() {
  return (
    <div style={ghostFrame} aria-hidden="true">
      <div style={ghostInner} />
    </div>
  );
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

const canvasStage: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "min(1152px, 80vw)",
  aspectRatio: "16 / 9",
  border: "1px solid var(--ghost-stroke)",
  borderRadius: 10,
  overflow: "hidden",
};
