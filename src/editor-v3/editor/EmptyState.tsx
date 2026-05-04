import { useRef, type ChangeEvent, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";

/**
 * Pre-editor state. A single big call-to-action opens the file picker;
 * a secondary link starts a blank canvas. Drag-drop and paste work here
 * too — the window-level handlers in App route through the same upload
 * flow regardless of whether this component is mounted.
 *
 * Uses a persistent <input ref={...} /> + .click() on the ref. Day 12
 * tried switching to a create-on-click DOM pattern (same as
 * lib/commands.openFilePicker) thinking it'd dodge a user-activation
 * issue. Empirically, Chrome rejected .click() on the freshly-appended
 * input from this specific path even though the synchronous chain was
 * intact (probe confirmed openPicker ran AND the input was created;
 * only the OS dialog was suppressed). The persistent-input pattern
 * carries activation correctly. lib/commands.openFilePicker still uses
 * create-on-click and works because its activation source is the cmdk
 * palette item, not the empty-state button — different code path,
 * different verdict from the activation tracker.
 */
export function EmptyState() {
  const setHasEntered = useUiStore((s) => s.setHasEntered);
  const setProjectsPanelOpen = useUiStore((s) => s.setProjectsPanelOpen);
  const user = useUiStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file twice still fires.
    e.target.value = "";
    if (file) await handleUploadedFile(file);
  };

  return (
    <div style={wrap}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onPick}
        aria-hidden="true"
        style={visuallyHidden}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={uploadTarget}
        aria-label="Upload to set sail — opens file picker"
      >
        <span style={ghostFrame} aria-hidden="true">
          <span style={ghostInner} />
          {/* Day 57 — painterly ship at horizon, overlaid on the
              ghost frame. Subtle (low opacity), centered, doesn't
              compete with the upload affordance. */}
          <ShipAtHorizon />
        </span>
        <span style={heading}>Upload to set sail</span>
      </button>
      <div style={secondaryRow}>
        <button
          type="button"
          onClick={() => setHasEntered(true)}
          style={secondaryLink}
        >
          or start blank →
        </button>
        {user && (
          <>
            <span style={separator} aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setProjectsPanelOpen(true)}
              style={secondaryLink}
              data-testid="empty-state-open-project"
            >
              Open project…
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 28,
};

const uploadTarget: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 28,
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "inherit",
};

const ghostFrame: CSSProperties = {
  width: "min(1152px, 80vw)",
  aspectRatio: "16 / 9",
  border: "1px dashed var(--ghost-stroke)",
  background: "var(--ghost-fill)",
  borderRadius: 10,
  position: "relative",
  boxShadow: "0 0 80px rgba(249, 240, 225, 0.04) inset",
  display: "block",
};

const ghostInner: CSSProperties = {
  position: "absolute",
  inset: 18,
  border: "1px dashed rgba(249, 240, 225, 0.06)",
  borderRadius: 6,
  display: "block",
};

const heading: CSSProperties = {
  // Day 57 — Playfair Display for the marquee headline. Cream,
  // italic, larger letter-spacing for editorial feel.
  fontFamily: '"Playfair Display", Georgia, serif',
  fontSize: 28,
  fontStyle: "italic",
  fontWeight: 500,
  letterSpacing: "0.005em",
  color: "var(--accent-cream)",
  margin: 0,
};

function ShipAtHorizon() {
  // Painterly silhouette: horizon line + small ship + faint
  // sun/moon disc behind it. Pure SVG, fixed positioning inside
  // the ghostFrame parent.
  return (
    <svg
      viewBox="0 0 600 340"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.18,
        pointerEvents: "none",
      }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Horizon line — full width, slightly below center. */}
      <line x1="40" y1="200" x2="560" y2="200" stroke="var(--accent-cream)" strokeWidth="1" strokeOpacity="0.5" />
      {/* Distant disc — sun/moon. */}
      <circle cx="350" cy="170" r="22" fill="var(--accent-cream)" fillOpacity="0.18" />
      {/* Ship silhouette — hull + sail. */}
      <g transform="translate(280 178)">
        <path d="M 0 22 L 40 22 L 35 30 L 5 30 Z" fill="var(--accent-cream)" fillOpacity="0.78" />
        <line x1="20" y1="0" x2="20" y2="22" stroke="var(--accent-cream)" strokeWidth="1" strokeOpacity="0.7" />
        <path d="M 20 4 L 34 20 L 20 20 Z" fill="var(--accent-cream)" fillOpacity="0.72" />
      </g>
      {/* Faint reflective ripples below the ship. */}
      <path d="M 270 250 Q 285 254 300 250 Q 315 254 330 250" stroke="var(--accent-cream)" strokeOpacity="0.18" strokeWidth="0.8" fill="none" />
      <path d="M 250 268 Q 280 274 310 268 Q 340 274 350 268" stroke="var(--accent-cream)" strokeOpacity="0.10" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

/** Day-12 bug fix. display:none inputs were silently rejected by
 * Chrome's user-activation tracker for programmatic .click() — the
 * picker would not open. The visually-hidden pattern keeps the
 * element in the layout tree but invisible + non-interactive, which
 * Chrome accepts. */
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const secondaryRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const secondaryLink: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 13,
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: "4px 8px",
  transition: "color var(--motion-fast) var(--ease-standard)",
};

const separator: CSSProperties = {
  color: "var(--text-secondary)",
  opacity: 0.5,
  fontSize: 13,
};
