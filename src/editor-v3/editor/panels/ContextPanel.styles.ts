import { type CSSProperties } from "react";

export const panel: CSSProperties = {
  width: 280,
  flexShrink: 0,
  position: "relative",
  zIndex: 1,
  // Day 63 fix — baked wood SVG as background-image. Opaque
  // wood-mid base prevents cosmic body bg bleed-through.
  backgroundColor: "var(--wood-mid)",
  backgroundImage:
    "linear-gradient(to left, rgba(245, 230, 200, 0.04), rgba(20, 14, 8, 0.20)), " +
    "url(\"/quarters/wood-wall-3.png\")",
  backgroundSize: "100% 100%, 400px 400px",
  backgroundRepeat: "no-repeat, repeat",
  borderLeft: "2px solid var(--brass-mid)",
  boxShadow:
    "inset 1px 0 0 0 rgba(255, 255, 255, 0.04), " +
    "inset 3px 0 0 0 var(--brass-bright)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  color: "var(--brass-cream)",
  overflowY: "auto",
};

export const panelHeader: CSSProperties = {
  // Day 61 — Fraunces serif small caps for parchment-card feel.
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 13,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--brass-cream)",
  fontWeight: 500,
  paddingBottom: 8,
  borderBottom: "1px solid rgba(200, 132, 62, 0.30)",
};

export const emptyHint: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 15,
  color: "var(--parchment-shadow)",
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
