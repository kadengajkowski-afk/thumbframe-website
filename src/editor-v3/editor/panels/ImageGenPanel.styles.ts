import type { CSSProperties } from "react";

/** Day 37 — ImageGenPanel styles split out so the .tsx stays under
 * the 400-line file ceiling. Same pattern as ExportPanel.styles.ts. */

export const keyframes = `@keyframes tf-img-scan { 0%{transform:translateY(0%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(100%);opacity:0} }`;

export const backdrop: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(8,10,16,0.7)",
  backdropFilter: "blur(6px)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 50,
};
export const card: CSSProperties = {
  width: 640, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto",
  background: "var(--bg-space-1)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 10,
  padding: 18, display: "flex", flexDirection: "column", gap: 12,
};
export const header: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase",
};
export const proBadge: CSSProperties = {
  fontSize: 10, padding: "2px 8px", borderRadius: 10,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  fontWeight: 600,
};
export const textarea: CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 13,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  resize: "vertical", fontFamily: "inherit",
};
export const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
export const chip: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "var(--bg-space-0)", color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)", borderRadius: 12, cursor: "pointer",
};
export const chipActive: CSSProperties = {
  ...chip, background: "var(--accent-orange)", color: "var(--bg-space-0)",
  borderColor: "var(--accent-orange)",
};
export const controlsRow: CSSProperties = {
  display: "flex", gap: 10, alignItems: "stretch",
};
export const aspectGroup: CSSProperties = { display: "flex", gap: 4 };
export const aspectBtn: CSSProperties = {
  padding: "6px 10px", fontSize: 11, background: "var(--bg-space-0)",
  color: "var(--text-secondary)", border: "1px solid var(--border-ghost)",
  borderRadius: 6, cursor: "pointer",
};
export const aspectActive: CSSProperties = {
  ...aspectBtn, color: "var(--text-primary)", borderColor: "var(--accent-orange)",
};
export const refDrop: CSSProperties = {
  flex: 1, padding: "6px 10px", fontSize: 11,
  background: "var(--bg-space-0)", color: "var(--text-secondary)",
  border: "1px dashed var(--border-ghost)", borderRadius: 6,
  cursor: "pointer", display: "flex", justifyContent: "space-between",
  alignItems: "center",
};
export const refDropHover: CSSProperties = { ...refDrop, borderColor: "var(--accent-orange)" };
export const refClear: CSSProperties = {
  background: "transparent", color: "var(--text-secondary)",
  border: "none", fontSize: 14, cursor: "pointer", padding: "0 4px",
};
export const primaryBtn: CSSProperties = {
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 6, cursor: "pointer",
};
export const primaryBtnDisabled: CSSProperties = {
  ...primaryBtn, opacity: 0.5, cursor: "not-allowed",
};
export const cancelBtn: CSSProperties = {
  padding: "9px 14px", fontSize: 13,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
export const errorRow: CSSProperties = {
  fontSize: 11, color: "var(--accent-orange)",
};
export const hint: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", padding: "20px 0",
};
export const resultMeta: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  letterSpacing: "0.04em", textTransform: "uppercase",
  marginBottom: 6, fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const grid: CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
};
export const cell: CSSProperties = {
  position: "relative", aspectRatio: "16/9", overflow: "hidden",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  borderRadius: 6,
};
export const img: CSSProperties = {
  width: "100%", height: "100%", objectFit: "cover", display: "block",
};
export const overlay: CSSProperties = {
  position: "absolute", inset: 0, background: "rgba(8,10,16,0.55)",
  display: "flex", flexDirection: "column", gap: 4,
  alignItems: "center", justifyContent: "center",
  opacity: 0, transition: "opacity 0.15s",
};
export const overlayBtn: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
};
export const loadingCell: CSSProperties = {
  position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: 6,
};
export const scanLine: CSSProperties = {
  position: "absolute", left: 0, right: 0, top: 0, height: 2,
  background: "linear-gradient(90deg, transparent, var(--accent-orange), transparent)",
  boxShadow: "0 0 12px var(--accent-orange)",
  animation: "tf-img-scan 3s linear infinite",
};
export const loadingTxt: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
