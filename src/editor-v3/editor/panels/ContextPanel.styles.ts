import { type CSSProperties } from "react";

export const panel: CSSProperties = {
  width: 280,
  flexShrink: 0,
  borderLeft: "1px solid var(--border-ghost)",
  background: "var(--bg-space-1)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  color: "var(--text-primary)",
  overflowY: "auto",
};

export const panelHeader: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-tertiary)",
  fontWeight: 500,
  // Day 57 — thin cream divider beneath the panel title.
  paddingBottom: 8,
  borderBottom: "1px solid rgba(249, 240, 225, 0.10)",
};

export const emptyHint: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Day 57 — serif treatment for the "Select something" empty
  // state. Playfair Display already loaded as part of the
  // bundled OFL set.
  fontFamily: '"Playfair Display", Georgia, serif',
  fontSize: 16,
  color: "var(--accent-cream)",
  opacity: 0.65,
  fontStyle: "italic",
  letterSpacing: "0.01em",
};

export const section: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export const layerNameRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 0",
  borderBottom: "1px solid var(--border-ghost)",
};

export const layerName: CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const fieldHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const fieldLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

export const fieldValue: CSSProperties = {
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "var(--text-secondary)",
};

export const fillRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

export const hexText: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  letterSpacing: "0.02em",
};

export const slider: CSSProperties = {
  width: "100%",
  accentColor: "var(--accent-orange)",
  cursor: "pointer",
};

export function swatch(color: number): CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: 3,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid rgba(0,0,0,0.25)",
    flexShrink: 0,
  };
}

export function swatchEllipse(color: number): CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid rgba(0,0,0,0.25)",
    flexShrink: 0,
  };
}

export function swatchText(color: number): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 3,
    background: "transparent",
    color: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid var(--border-ghost)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: 11,
    flexShrink: 0,
    lineHeight: 1,
  };
}

export function swatchBig(color: number): CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 5,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid var(--border-ghost-hover)",
    cursor: "pointer",
    padding: 0,
  };
}

// Image-layer placeholder in the layer-name row. Real thumbnail
// rendering is DEFERRED.
export const imageSwatch: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  background:
    "linear-gradient(135deg, var(--bg-space-2) 0%, var(--accent-navy) 100%)",
  border: "1px solid var(--border-ghost)",
  flexShrink: 0,
};

export const sourceMeta: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "var(--text-secondary)",
};
