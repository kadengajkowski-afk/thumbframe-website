import { type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";

/**
 * Pre-editor state. A single big call-to-action opens the file picker;
 * a secondary link starts a blank canvas. Drag-drop and paste work here
 * too — the window-level handlers in App route through the same upload
 * flow regardless of whether this component is mounted.
 *
 * The file input is created-on-click via DOM, NOT a persistent
 * <input ref={...} />. Day 12 introduced a (still-unidentified)
 * regression where the persistent-input pattern + .click() failed to
 * open the OS picker — the user-gesture chain was breaking somewhere
 * between the React onClick fire and the ref's input.click(). The
 * createElement-then-click pattern (same one used by the command-
 * palette upload that DID keep working through Day 12) does not have
 * the regression. Keep both empty-state and palette uploads on the
 * same path so a single fix covers both.
 */
export function EmptyState() {
  const setHasEntered = useUiStore((s) => s.setHasEntered);

  function openPicker() {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (file) await handleUploadedFile(file);
    });
    document.body.appendChild(input);
    input.click();
  }

  return (
    <div style={wrap}>
      <button
        type="button"
        onClick={openPicker}
        style={uploadTarget}
        aria-label="Upload to set sail — opens file picker"
      >
        <span style={ghostFrame} aria-hidden="true">
          <span style={ghostInner} />
        </span>
        <span style={heading}>Upload to set sail</span>
      </button>
      <button
        type="button"
        onClick={() => setHasEntered(true)}
        style={startBlank}
      >
        or start blank →
      </button>
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
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.01em",
  color: "var(--accent-cream)",
  margin: 0,
};

const startBlank: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 13,
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: "4px 8px",
  transition: "color var(--motion-fast) var(--ease-standard)",
};
