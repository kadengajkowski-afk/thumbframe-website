import { useRef, type ChangeEvent, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";
import {
  STARTER_TEMPLATES,
  useOnboardingStore,
  type StarterTemplateId,
} from "@/state/onboardingStore";
import { applyStarter } from "@/lib/applyStarter";

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
  // Day 52 — for users who have completed (or skipped) onboarding,
  // the empty state surfaces the same 4 starter shortcuts + upload
  // they saw during onboarding. Returning-user superpower: no
  // tutorial, just the choices. Pre-onboarding users see this same
  // surface BEHIND the onboarding overlay, so the cards are
  // discoverable post-skip too.
  const completed = useOnboardingStore((s) => s.completed);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file twice still fires.
    e.target.value = "";
    if (file) await handleUploadedFile(file);
  };

  function pickStarter(id: StarterTemplateId) {
    if (id === "blank") {
      setHasEntered(true);
      return;
    }
    applyStarter(id);
    setHasEntered(true);
  }

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
      {/* Day 52 — starter shortcuts. Visible for completed-onboarding
          users (so they can still pick a starter without re-running
          the flow) and for skip-from-onboarding users (the cards they
          would have seen are still here). Hidden during onboarding
          itself because the overlay is in front. */}
      {completed && (
        <div style={starterRow} data-testid="empty-state-starters">
          {STARTER_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              style={starterChip}
              onClick={() => pickStarter(t.id)}
              data-testid={`empty-state-starter-${t.id}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
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

// Day 52 — starter shortcut chips for the post-onboarding empty
// state. Tighter visual than the onboarding cards — designed for
// returning users who know what they want.
const starterRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
  justifyContent: "center",
  maxWidth: 480,
};

const starterChip: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  letterSpacing: "0.04em",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 14,
  cursor: "pointer",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
