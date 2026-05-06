import { lazy, Suspense, useRef, type ChangeEvent, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { handleUploadedFile } from "@/lib/uploadFlow";

// Day 67 — empty-state cosmic scene lazy-loaded so the three.js
// stack only resolves when the user actually sees the empty state.
// Static cosmic body bg keeps the screen full while the chunk loads.
const EmptyStateScene = lazy(() =>
  import("@/editor/scenes/EmptyStateScene").then((m) => ({ default: m.EmptyStateScene })),
);

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
      {/* Day 67 — live cosmic scene fills the empty state behind
          the upload card. Constellation paint dabs + drifting stars
          + occasional shooting streaks. Renders behind the card via
          the wrap container's relative positioning. */}
      <Suspense fallback={null}>
        <EmptyStateScene />
      </Suspense>
      {/* Day 60 — refined chart-room card with painted brass corner
          ornaments + celestial compass marker. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={uploadTarget}
        aria-label="Upload to set sail — opens file picker"
      >
        <BrassCorner position="tl" />
        <BrassCorner position="tr" />
        <BrassCorner position="bl" />
        <BrassCorner position="br" />
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

/** Day 60 — celestial chart marker. Painted compass with amber needle
 *  pip, imperfect cream rings (slight wobble suggesting hand-drawn),
 *  surrounded by 4 small star pips at the cardinal halfway points. */
function CompassRose() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ display: "block", marginBottom: 6 }}
    >
      {/* Star pips at compass halves — N-NE / S-SE / S-SW / N-NW */}
      {[
        [50, 14], [50, 50], [14, 50], [14, 14],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill="var(--cream-100)" opacity="0.55" />
      ))}
      {/* Outer ring — slight quadratic wobble suggests hand-painted */}
      <path
        d="M32 4 Q56 8 60 32 Q56 56 32 60 Q8 56 4 32 Q8 8 32 4 Z"
        fill="none"
        stroke="var(--cream-100)"
        strokeWidth="1.4"
        opacity="0.65"
      />
      {/* Inner ring — also slightly imperfect */}
      <path
        d="M32 18 Q44 20 46 32 Q44 44 32 46 Q20 44 18 32 Q20 20 32 18 Z"
        fill="none"
        stroke="var(--cream-100)"
        strokeWidth="1"
        opacity="0.42"
      />
      {/* North needle — amber, prominent */}
      <path d="M32 6 L35 30 L32 32 L29 30 Z" fill="var(--accent-amber)" opacity="0.98" />
      {/* South needle — cream */}
      <path d="M32 58 L35 34 L32 32 L29 34 Z" fill="var(--cream-100)" opacity="0.55" />
      {/* East + West — fainter */}
      <path d="M58 32 L34 35 L32 32 L34 29 Z" fill="var(--cream-100)" opacity="0.42" />
      <path d="M6 32 L30 35 L32 32 L30 29 Z" fill="var(--cream-100)" opacity="0.42" />
      {/* Hub */}
      <circle cx="32" cy="32" r="2.2" fill="var(--accent-amber)" />
      <circle cx="32" cy="32" r="0.8" fill="var(--cream-100)" />
    </svg>
  );
}

/** Day 60 — painted brass corner ornaments. Two crossing brushstrokes
 *  per corner suggest hand-painted edge decoration without reading as
 *  literal corner brackets. position:absolute relative to the card. */
function BrassCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const top = position.startsWith("t");
  const left = position.endsWith("l");
  const wrap: CSSProperties = {
    position: "absolute",
    top: top ? 8 : "auto",
    bottom: top ? "auto" : 8,
    left: left ? 8 : "auto",
    right: left ? "auto" : 8,
    width: 28,
    height: 28,
    pointerEvents: "none",
  };
  // Mirror SVG paths so corner accent angles outward toward each corner.
  const flipX = !left ? "scale(-1 1) translate(-28 0)" : "";
  const flipY = !top ? "scale(1 -1) translate(0 -28)" : "";
  const transform = [flipX, flipY].filter(Boolean).join(" ");
  return (
    <svg
      style={wrap}
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <g transform={transform}>
        {/* Long stroke along the top edge */}
        <path
          d="M2 4 Q8 3 14 5"
          fill="none"
          stroke="var(--accent-amber)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* Short cross stroke down */}
        <path
          d="M4 2 Q5 8 6 14"
          fill="none"
          stroke="var(--accent-amber)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* Cream highlight wisp */}
        <path
          d="M5 5 Q9 5.5 13 6"
          fill="none"
          stroke="var(--cream-100)"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
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

/* Day 60 — refined chart-room card. Frosted glass at 65% alpha +
 * heavier 20px blur, solid brass-amber border (35% opacity) replaces
 * the dashed cream border, painted brass corner ornaments at each
 * corner. Position:relative so the absolutely-positioned corners
 * land inside the card bounds. */
const uploadTarget: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  background: "rgba(10, 7, 20, 0.65)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)" as CSSProperties["backdropFilter"],
  border: "1px solid rgba(249, 115, 22, 0.35)",
  boxShadow:
    "inset 0 1px 0 0 rgba(255, 244, 224, 0.06), " +
    "0 8px 40px -8px rgba(249, 115, 22, 0.18)",
  borderRadius: 14,
  padding: "36px 56px 32px",
  minWidth: 380,
  maxWidth: 520,
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

/* Day 64b — bumped from 0.5 → 0.7 alpha + text-shadow so the link
 * reads against the painterly nebula backdrop (light cloud regions
 * were swallowing the cream type at 50%). */
const secondaryLink: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(244, 234, 213, 0.7)",
  fontFamily: "var(--font-ui)",
  fontStyle: "italic",
  fontSize: 13,
  letterSpacing: "0.02em",
  cursor: "pointer",
  padding: "4px 8px",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
  transition: "color var(--motion-fast) var(--ease-standard)",
};

const separator: CSSProperties = {
  color: "rgba(244, 234, 213, 0.7)",
  fontSize: 13,
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
};
