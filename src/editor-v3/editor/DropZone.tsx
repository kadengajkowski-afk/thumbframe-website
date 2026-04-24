import { type CSSProperties } from "react";

/** Fullscreen drop target overlay. Shown while a drag containing files
 * is over the window. Styling uses --border-ghost-hover per spec. */
export function DropZone() {
  return (
    <div style={scrim} role="presentation" aria-hidden="true">
      <div style={frame}>
        <span style={label}>Drop to upload</span>
      </div>
    </div>
  );
}

const scrim: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(5, 5, 16, 0.62)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 90,
  pointerEvents: "none",
  animation: "fadeIn 120ms ease-out",
};

const frame: CSSProperties = {
  width: "min(920px, 70vw)",
  aspectRatio: "16 / 9",
  border: "2px dashed var(--border-ghost-hover)",
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(249, 240, 225, 0.03)",
};

const label: CSSProperties = {
  color: "var(--accent-cream)",
  fontSize: 20,
  letterSpacing: "0.04em",
  fontWeight: 500,
};
