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
};

export const emptyHint: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: "var(--text-tertiary)",
  fontStyle: "italic",
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
