import { type CSSProperties, useEffect, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import { CREW, getCrew } from "@/lib/crew";
import { CrewAvatar } from "../crewAvatars";

/** Days 41-42 — crew picker. Polish pass:
 *
 * Now in two pieces. The Trigger lives in the panel header next to
 * the "ThumbFriend" label and toggles uiStore.crewPickerOpen. The
 * Dropdown is rendered as a sibling of the header inside the panel
 * aside, so it spans the full 360-px panel width and flows downward
 * — no more right-edge overflow when crew names are long. */

// ── Trigger ─────────────────────────────────────────────────────────

export function ThumbFriendCrewTrigger() {
  const activeId = useUiStore((u) => u.activeCrewMember);
  const open = useUiStore((u) => u.crewPickerOpen);
  const setOpen = useUiStore((u) => u.setCrewPickerOpen);
  const active = getCrew(activeId);

  return (
    <button
      type="button"
      style={trigger}
      onClick={() => setOpen(!open)}
      aria-haspopup="listbox"
      aria-expanded={open}
      data-testid="thumbfriend-crew-trigger"
    >
      <CrewAvatar id={active.id} size={16} />
      <span style={triggerLabel}>{active.name}</span>
      <span style={triggerCaret}>⌄</span>
    </button>
  );
}

// ── Dropdown ────────────────────────────────────────────────────────

export function ThumbFriendCrewDropdown() {
  const activeId = useUiStore((u) => u.activeCrewMember);
  const setCrew = useUiStore((u) => u.setActiveCrewMember);
  const setIntroDismissed = useUiStore((u) => u.setCrewIntroDismissed);
  const open = useUiStore((u) => u.crewPickerOpen);
  const setOpen = useUiStore((u) => u.setCrewPickerOpen);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      // Don't close if the click landed on the trigger (it'll toggle itself).
      const target = e.target as HTMLElement;
      if (target.closest('[data-testid="thumbfriend-crew-trigger"]')) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  if (!open) return null;

  function pick(id: string) {
    setCrew(id);
    setIntroDismissed(true);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} role="listbox" style={dropdown} data-testid="thumbfriend-crew-dropdown">
      {CREW.map((m) => {
        const isActive = m.id === activeId;
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => pick(m.id)}
            style={isActive ? cardActive : card}
            data-testid={`thumbfriend-crew-${m.id}`}
          >
            <span style={cardAvatar}>
              <CrewAvatar id={m.id} size={32} active={isActive} />
            </span>
            <span style={cardBody}>
              <span style={cardTopRow}>
                <span style={cardName}>{m.name}</span>
                <span style={cardRole}>{m.role}</span>
              </span>
              <span style={cardTagline}>{m.tagline}</span>
              <span style={cardUseCase}>For: {m.useCase}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const trigger: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "4px 8px", fontSize: 12,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const triggerLabel: CSSProperties = { letterSpacing: "0.04em" };
const triggerCaret: CSSProperties = { fontSize: 10, opacity: 0.7 };

/** Dropdown spans the full panel width below the header + tabs.
 * Caller mounts this as a sibling of the header inside the panel
 * `aside` (which has overflow:hidden). flex-shrink:0 keeps the
 * scroller below it from clipping the cards. */
const dropdown: CSSProperties = {
  flexShrink: 0,
  maxHeight: 360, overflowY: "auto",
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-ghost)",
  padding: 8, display: "flex", flexDirection: "column", gap: 6,
};
const cardBase: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
  padding: "8px 10px", background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
  width: "100%", boxSizing: "border-box",
};
const card: CSSProperties = cardBase;
const cardActive: CSSProperties = {
  ...cardBase, borderColor: "var(--accent-orange)",
  background: "rgba(249,115,22,0.08)",
};
const cardAvatar: CSSProperties = {
  flexShrink: 0, marginTop: 2,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const cardBody: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 };
const cardTopRow: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" };
const cardName: CSSProperties = { fontSize: 13, fontWeight: 600 };
const cardRole: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  letterSpacing: "0.06em", textTransform: "uppercase",
};
const cardTagline: CSSProperties = { fontSize: 12, color: "var(--text-primary)" };
const cardUseCase: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
