import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { CREW, getCrew } from "@/lib/crew";
import { CrewAvatar } from "../crewAvatars";

/** Days 41-42 — crew picker rendered in the ThumbFriendPanel header.
 *
 * Shows the active crew member's avatar + name with a ⌄ chevron;
 * click opens a dropdown of all six crew cards. Click outside or
 * select a card to close. The active card carries an --accent-orange
 * border. Mounted next to the panel close button. */

export function ThumbFriendCrewPicker() {
  const activeId = useUiStore((u) => u.activeCrewMember);
  const setCrew = useUiStore((u) => u.setActiveCrewMember);
  const setIntroDismissed = useUiStore((u) => u.setCrewIntroDismissed);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = getCrew(activeId);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
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
  }, [open]);

  function pick(id: string) {
    setCrew(id);
    setIntroDismissed(true);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={wrap} data-testid="thumbfriend-crew-picker">
      <button
        type="button"
        style={trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="thumbfriend-crew-trigger"
      >
        <CrewAvatar id={active.id} size={16} />
        <span style={triggerLabel}>{active.name}</span>
        <span style={triggerCaret}>⌄</span>
      </button>
      {open && (
        <div role="listbox" style={dropdown} data-testid="thumbfriend-crew-dropdown">
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
                  <CrewAvatar id={m.id} size={32} />
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
      )}
    </div>
  );
}

const wrap: CSSProperties = { position: "relative" };
const trigger: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "4px 8px", fontSize: 12,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const triggerLabel: CSSProperties = { letterSpacing: "0.04em" };
const triggerCaret: CSSProperties = { fontSize: 10, opacity: 0.7 };
const dropdown: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0,
  width: 320, maxHeight: 480, overflowY: "auto",
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  padding: 6, display: "flex", flexDirection: "column", gap: 4,
  zIndex: 60,
};
const cardBase: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
  padding: "8px 10px", background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
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
const cardBody: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
const cardTopRow: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8 };
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
