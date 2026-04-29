import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  FONT_REGISTRY,
  ensureFontLoaded,
  type FontMeta,
} from "@/lib/fonts";
import { useUiStore } from "@/state/uiStore";
import type { FontCategory } from "@/state/types";

/** Day 13 commit 7 — searchable font picker popover. Replaces the
 * <select> in TextProperties. Each row previews the family name in
 * its own face. Recently-used fonts pin to the top. Live filter on
 * keystroke. Categories serve as section headers. */
export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const recent = useUiStore((s) => s.recentFonts);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click closes the popover. Escape too.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pinned = useUiStore((s) => s.pinnedBrandKit);
  const brandFontNames = pinned?.fonts?.map((f) => f.name) ?? [];
  const brandLabel = pinned ? `Brand · ${pinned.channelTitle}` : null;
  const grouped = useMemo(
    () => groupFonts(query, recent, brandFontNames, brandLabel),
    [query, recent, brandFontNames.join(","), brandLabel],
  );

  return (
    <div ref={containerRef} style={wrap}>
      <button
        type="button"
        style={trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span style={{ fontFamily: `"${value}", system-ui, sans-serif` }}>
          {value}
        </span>
        <span style={chevron}>▾</span>
      </button>
      {open ? (
        <div style={popover} role="listbox">
          <input
            autoFocus
            type="search"
            placeholder="Search fonts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={searchInput}
          />
          <div style={list}>
            {grouped.length === 0 ? (
              <div style={emptyState}>No fonts match "{query}"</div>
            ) : (
              grouped.map((group) => (
                <Group
                  key={group.label}
                  group={group}
                  selected={value}
                  onPick={(family) => {
                    onChange(family);
                    useUiStore.getState().addRecentFont(family);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Group = { label: string; fonts: FontMeta[] };

function Group({
  group,
  selected,
  onPick,
}: {
  group: Group;
  selected: string;
  onPick: (family: string) => void;
}) {
  return (
    <div>
      <div style={groupHeader}>{group.label}</div>
      {group.fonts.map((meta) => (
        <FontRow
          key={meta.family}
          meta={meta}
          active={meta.family === selected}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function FontRow({
  meta,
  active,
  onPick,
}: {
  meta: FontMeta;
  active: boolean;
  onPick: (family: string) => void;
}) {
  // Kick a load on first hover so the preview sharpens before click.
  const onHover = () => {
    void ensureFontLoaded(meta.family, meta.weights[0]!);
  };
  return (
    <button
      type="button"
      style={active ? rowActive : row}
      onClick={() => onPick(meta.family)}
      onMouseEnter={onHover}
      onFocus={onHover}
      role="option"
      aria-selected={active}
    >
      <span style={{ fontFamily: `"${meta.family}", system-ui, sans-serif` }}>
        {meta.family}
      </span>
    </button>
  );
}

function groupFonts(
  query: string,
  recent: readonly string[],
  brandFontNames: readonly string[],
  brandLabel: string | null,
): Group[] {
  const q = query.trim().toLowerCase();
  const matches = (m: FontMeta) =>
    !q || m.family.toLowerCase().includes(q);

  const groups: Group[] = [];

  // Day 33 — pinned-kit fonts at the very top.
  if (brandLabel && brandFontNames.length > 0) {
    const brandMetas = brandFontNames
      .map((f) => FONT_REGISTRY.find((m) => m.family === f))
      .filter((m): m is FontMeta => !!m && matches(m));
    if (brandMetas.length > 0) {
      groups.push({ label: brandLabel, fonts: brandMetas });
    }
  }

  const recentMetas = recent
    .map((f) => FONT_REGISTRY.find((m) => m.family === f))
    .filter((m): m is FontMeta => !!m && matches(m));
  if (recentMetas.length > 0) {
    groups.push({ label: "Recent", fonts: recentMetas });
  }

  for (const cat of CATEGORY_ORDER) {
    const fonts = FONT_REGISTRY.filter(
      (m) => m.category === cat && matches(m),
    );
    if (fonts.length > 0) {
      groups.push({ label: CATEGORY_LABEL[cat as FontCategory], fonts });
    }
  }
  return groups;
}

const wrap: CSSProperties = { position: "relative", width: "100%" };

const trigger: CSSProperties = {
  width: "100%",
  height: 28,
  padding: "0 8px",
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  textAlign: "left",
};

const chevron: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
};

const popover: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 40,
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  boxShadow: "0 10px 24px rgba(0,0,0,0.5)",
  display: "flex",
  flexDirection: "column",
  maxHeight: 360,
  overflow: "hidden",
};

const searchInput: CSSProperties = {
  height: 30,
  padding: "0 10px",
  margin: 6,
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  fontSize: 13,
  outline: "none",
};

const list: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  paddingBottom: 6,
};

const groupHeader: CSSProperties = {
  padding: "6px 12px 2px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-secondary)",
};

const row: CSSProperties = {
  width: "100%",
  padding: "6px 12px",
  background: "transparent",
  color: "var(--text-primary)",
  border: "none",
  borderLeft: "2px solid transparent",
  cursor: "pointer",
  fontSize: 16,
  textAlign: "left",
  lineHeight: 1.2,
};

const rowActive: CSSProperties = {
  ...row,
  background: "var(--bg-space-2)",
  borderLeft: "2px solid var(--accent-orange)",
};

const emptyState: CSSProperties = {
  padding: "16px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
  textAlign: "center",
};
