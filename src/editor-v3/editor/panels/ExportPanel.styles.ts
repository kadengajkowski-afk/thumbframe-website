import type { CSSProperties } from "react";

export const PREVIEW_W = 320;
export const PREVIEW_H = 180;

export const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.7)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};
export const card: CSSProperties = {
  width: 480,
  background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 10,
  padding: "20px 22px",
  color: "var(--text-primary)",
  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
};
export const cardHeader: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--accent-cream)",
  marginBottom: 14,
};
export const section: CSSProperties = { marginBottom: 14 };
export const sectionLabel: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 6,
};
export const formatRow: CSSProperties = { display: "flex", gap: 8 };
export const formatBtn: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  padding: "8px 6px",
  color: "var(--text-primary)",
  cursor: "pointer",
  textAlign: "center",
};
export const formatBtnActive: CSSProperties = {
  background: "var(--accent-orange)",
  // Use the full shorthand so React doesn't warn about mixing
  // `border` (from formatBtn) with `borderColor` longhand here.
  border: "1px solid var(--accent-orange)",
  color: "var(--bg-space-0)",
};
export const formatBtnPro: CSSProperties = { opacity: 0.65 };
export const formatBtnLabel: CSSProperties = { fontSize: 13, fontWeight: 600 };
export const formatBtnSub: CSSProperties = { fontSize: 10, opacity: 0.7, marginTop: 2 };
export const qualityNum: CSSProperties = { color: "var(--accent-cream)", marginLeft: 6 };
export const slider: CSSProperties = { width: "100%" };
export const previewBox: CSSProperties = {
  width: PREVIEW_W,
  height: PREVIEW_H,
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
export const previewImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};
export const previewEmpty: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
};
export const previewMeta: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
  marginTop: 6,
};
export const warn: CSSProperties = { color: "var(--accent-orange)" };
export const input: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 12,
};
export const footer: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};
export const cancelBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 6,
  padding: "8px 18px",
  color: "var(--text-primary)",
  cursor: "pointer",
};
export const shipBtn: CSSProperties = {
  background: "var(--accent-orange)",
  border: "none",
  borderRadius: 6,
  padding: "8px 22px",
  color: "var(--bg-space-0)",
  fontWeight: 600,
  cursor: "pointer",
};
