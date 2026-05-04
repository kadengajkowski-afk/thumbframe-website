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
      {/* Day 58 retry — "chart room" empty state. Small centered card
          on the cosmic-deck atmosphere. NOT a full-screen ship hero. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={uploadTarget}
        aria-label="Upload to set sail — opens file picker"
      >
        <CompassRose />
        <span style={heading}>Upload to set sail</span>
        <span style={subheading}>drop a thumbnail here</span>
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

/** Day 58 — placeholder painted compass rose. Geometric SVG until
 *  Day 60's hand-painted icon set lands. Cream stroke + amber pip
 *  at top to read as "north". */
function CompassRose() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      aria-hidden="true"
      style={{ display: "block", marginBottom: 4 }}
    >
      {/* Outer ring */}
      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--cream-100)" strokeWidth="1.4" opacity="0.6" />
      {/* Inner ring */}
      <circle cx="28" cy="28" r="14" fill="none" stroke="var(--cream-100)" strokeWidth="1" opacity="0.4" />
      {/* North pip — amber */}
      <path d="M28 4 L31 26 L28 28 L25 26 Z" fill="var(--accent-amber)" opacity="0.95" />
      {/* South */}
      <path d="M28 52 L31 30 L28 28 L25 30 Z" fill="var(--cream-100)" opacity="0.55" />
      {/* East */}
      <path d="M52 28 L30 31 L28 28 L30 25 Z" fill="var(--cream-100)" opacity="0.45" />
      {/* West */}
      <path d="M4 28 L26 31 L28 28 L26 25 Z" fill="var(--cream-100)" opacity="0.45" />
      {/* Hub */}
      <circle cx="28" cy="28" r="2" fill="var(--accent-amber)" />
    </svg>
  );
}

const wrap: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 18,
};

/* Day 58 retry — frosted glass card, ~360px wide, centered. Replaces
 * the giant 80vw dashed-frame ghost canvas that made the empty state
 * fight with the cosmic atmosphere. */
const uploadTarget: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  background: "var(--panel-frost-bg)",
  backdropFilter: "var(--panel-frost-blur)",
  WebkitBackdropFilter: "var(--panel-frost-blur)" as CSSProperties["backdropFilter"],
  border: "1px dashed rgba(255, 244, 224, 0.30)",
  borderRadius: 12,
  padding: "32px 48px 28px",
  minWidth: 360,
  maxWidth: 480,
  cursor: "pointer",
  color: "inherit",
  transition:
    "border-color var(--motion-fast) var(--ease-standard), " +
    "background var(--motion-fast) var(--ease-standard), " +
    "transform var(--motion-fast) var(--ease-standard)",
};

const heading: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "0.005em",
  color: "var(--cream-100)",
  margin: 0,
  lineHeight: 1.15,
};

const subheading: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--cream-60)",
  margin: 0,
};

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
