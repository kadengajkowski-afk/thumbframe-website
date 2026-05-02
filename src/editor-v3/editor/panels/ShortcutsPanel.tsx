import { useEffect, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";

/** Day 53 — Keyboard Shortcuts reference modal.
 *
 * Trigger: Cmd+? (the "?" key with meta) OR via the Cmd+K command
 * palette entry "Keyboard shortcuts". Closes on Esc or scrim click.
 *
 * Layout: centered card, max 600px, sectioned (Tools / AI / Editing /
 * File / View / Modifiers). Sections are static — single source of
 * truth for what's reachable by keyboard. If a hotkey changes in
 * lib/commands.ts, this list must be updated too. (See DEFERRED for
 * a future "auto-derive from commands.ts" pass.)
 *
 * Lazy-loaded from App.tsx so the boot path doesn't pay for the
 * lookup table when the user never opens it. */

type Group = {
  title: string;
  rows: { keys: string; label: string }[];
};

const GROUPS: Group[] = [
  {
    title: "Tools",
    rows: [
      { keys: "V", label: "Select" },
      { keys: "H", label: "Hand (pan)" },
      { keys: "R", label: "Rectangle" },
      { keys: "O", label: "Ellipse" },
      { keys: "T", label: "Text" },
      { keys: "⌘I", label: "Upload image" },
    ],
  },
  {
    title: "AI",
    rows: [
      { keys: "⌘/", label: "ThumbFriend" },
      { keys: "⌘G", label: "Generate image" },
      { keys: "⌘B", label: "Brand Kit" },
      { keys: "⌘⇧P", label: "Preview rack" },
    ],
  },
  {
    title: "Editing",
    rows: [
      { keys: "⌘Z", label: "Undo" },
      { keys: "⌘⇧Z", label: "Redo" },
      { keys: "⌘D", label: "Duplicate layer" },
      { keys: "Del", label: "Delete layer" },
      { keys: "]", label: "Bring forward" },
      { keys: "[", label: "Send backward" },
      { keys: "⇧]", label: "Bring to front" },
      { keys: "⇧[", label: "Send to back" },
    ],
  },
  {
    title: "File",
    rows: [
      { keys: "⌘N", label: "New project" },
      { keys: "⌘S", label: "Save (auto-saves anyway)" },
      { keys: "⌘E", label: "Ship it (export)" },
      { keys: "⌘⇧E", label: "Re-ship with last settings" },
      { keys: "⌘K", label: "Command palette" },
      { keys: "⌘?", label: "This help" },
    ],
  },
  {
    title: "View",
    rows: [
      { keys: "⌘0", label: "Fit to canvas" },
      { keys: "⌘1", label: "100% zoom" },
      { keys: "⌘+ / ⌘−", label: "Zoom in / out" },
      { keys: "⌘\\", label: "Toggle smart guides" },
    ],
  },
  {
    title: "Modifiers",
    rows: [
      { keys: "Shift while resizing", label: "Lock aspect ratio" },
      { keys: "Alt while resizing", label: "Resize from center" },
      { keys: "Shift while clicking layer", label: "Range select" },
      { keys: "Cmd while clicking layer", label: "Toggle in selection" },
      { keys: "Space + drag", label: "Temporary hand mode" },
    ],
  },
];

export function ShortcutsPanel() {
  const open = useUiStore((s) => s.shortcutsPanelOpen);
  const setOpen = useUiStore((s) => s.setShortcutsPanelOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      style={scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="presentation"
    >
      <div
        style={card}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
        data-testid="shortcuts-panel"
      >
        <header style={header}>
          <h2 style={heading}>Keyboard shortcuts</h2>
          <button
            type="button"
            style={closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Close keyboard shortcuts"
            data-testid="shortcuts-close"
          >
            ×
          </button>
        </header>
        <div style={scroller}>
          {GROUPS.map((g) => (
            <section key={g.title} style={group} aria-label={g.title}>
              <h3 style={groupHeading}>{g.title}</h3>
              <dl style={list}>
                {g.rows.map((row) => (
                  <div key={row.label} style={row_}>
                    <dt style={dt}>{row.label}</dt>
                    <dd style={dd}>
                      <kbd style={kbd}>{row.keys}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const scrim: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(5, 5, 16, 0.7)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 80,
};

const card: CSSProperties = {
  width: "min(600px, 90vw)",
  maxHeight: "min(640px, 86vh)",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid var(--border-ghost)",
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontWeight: 500,
};

const closeBtn: CSSProperties = {
  width: 24, height: 24, padding: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none",
  color: "var(--text-secondary)",
  fontSize: 20, cursor: "pointer", borderRadius: 4,
};

const scroller: CSSProperties = {
  padding: "12px 18px 18px",
  overflowY: "auto",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px 24px",
};

const group: CSSProperties = { breakInside: "avoid" };

const groupHeading: CSSProperties = {
  margin: "8px 0 6px",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--accent-cream)",
  fontWeight: 500,
};

const list: CSSProperties = { margin: 0, display: "flex", flexDirection: "column", gap: 4 };

const row_: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "4px 0",
  borderBottom: "1px solid var(--border-ghost)",
};

const dt: CSSProperties = {
  fontSize: 12,
  color: "var(--text-primary)",
};

const dd: CSSProperties = { margin: 0 };

const kbd: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent-cream)",
  background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)",
  padding: "2px 6px",
  borderRadius: 4,
  whiteSpace: "nowrap",
};
