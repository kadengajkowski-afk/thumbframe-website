import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { runCommand } from "@/lib/commands";
import { Tooltip } from "./Tooltip";

/** Day 53 — AI tools dropdown. Click the wand button → 4-entry menu
 * (Generate Image / Brand Kit / Preview Rack / Background Remove).
 *
 * Background Remove is enabled only when the user has an image layer
 * selected (the BG remove section in ContextPanel is the real surface;
 * this entry just selects the layer's panel). When no image is
 * selected, the entry is disabled with an inline hint.
 *
 * Closes on Esc, outside-click, or item activation. Arrow-key nav +
 * Enter would be ideal — held until the menu grows past 4 items. */

type Item = {
  id: string;
  label: string;
  shortcut: string;
  command: string;
  /** Optional gate; when true the item still renders but disabled. */
  disabled?: boolean;
  disabledReason?: string;
};

export function AiToolsMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const selectedIds = useUiStore((s) => s.selectedLayerIds);
  const layers = useDocStore((s) => s.layers);
  const hasImageSelection = selectedIds.some((id) =>
    layers.find((l) => l.id === id)?.type === "image",
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Defer mousedown registration past the current tick so the
    // click that opened the menu doesn't immediately close it
    // (React 19 StrictMode replays effects, exposing the race).
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const items: Item[] = [
    { id: "image-gen", label: "Generate image",   shortcut: "⌘G",      command: "file.image-gen" },
    { id: "brand-kit", label: "Brand Kit",        shortcut: "⌘B",      command: "file.brand-kit" },
    { id: "preview",   label: "Preview rack",     shortcut: "⌘⇧P",    command: "view.toggle-preview-rack" },
    {
      id: "bg-remove", label: "Background remove", shortcut: "—",
      command: "ai.bg-remove-focus",
      disabled: !hasImageSelection,
      disabledReason: "Select an image layer first",
    },
  ];

  return (
    <span ref={wrapRef} style={wrap}>
      <Tooltip label="AI tools" shortcut="⌘K to search">
        <button
          type="button"
          className={open ? "tool-button tool-button--active" : "tool-button"}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="AI tools"
          data-testid="tool-palette-ai-menu"
        >
          <WandIcon />
        </button>
      </Tooltip>
      {open && (
        <div role="menu" style={menu} data-testid="ai-tools-menu">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              style={it.disabled ? itemDisabled : item}
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                runCommand(it.command);
              }}
              data-testid={`ai-tools-menu-${it.id}`}
              title={it.disabled ? it.disabledReason : undefined}
            >
              <span style={itemLabel}>{it.label}</span>
              <span style={itemShortcut}>{it.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function WandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {/* wand handle */}
      <line x1="5" y1="15" x2="13" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* sparkle 1 */}
      <path d="M 14 4 L 14.7 5.5 L 16.2 6.2 L 14.7 6.9 L 14 8.4 L 13.3 6.9 L 11.8 6.2 L 13.3 5.5 Z"
        fill="currentColor" fillOpacity="0.9" />
      {/* sparkle 2 (smaller) */}
      <path d="M 17 11 L 17.4 11.8 L 18.2 12.2 L 17.4 12.6 L 17 13.4 L 16.6 12.6 L 15.8 12.2 L 16.6 11.8 Z"
        fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

const wrap: CSSProperties = { position: "relative", display: "inline-flex" };

const menu: CSSProperties = {
  position: "absolute",
  left: "calc(100% + 10px)",
  top: 0,
  minWidth: 220,
  background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  padding: 4,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
  zIndex: 60,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const item: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "8px 12px",
  border: "none",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
  borderRadius: 4,
  width: "100%",
};

const itemDisabled: CSSProperties = {
  ...item,
  color: "var(--text-tertiary)",
  cursor: "not-allowed",
};

const itemLabel: CSSProperties = { letterSpacing: "0.02em" };

const itemShortcut: CSSProperties = {
  fontSize: 11,
  color: "var(--text-tertiary)",
  fontFamily: "var(--font-mono)",
};
