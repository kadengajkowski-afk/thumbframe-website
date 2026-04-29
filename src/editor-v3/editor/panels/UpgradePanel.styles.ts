import type { CSSProperties } from "react";

/** Day 38 — UpgradePanel styles split out so the .tsx stays under
 * the 200-line spec ceiling. */

export const backdrop: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(8,10,16,0.7)",
  backdropFilter: "blur(6px)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 50,
};
export const card: CSSProperties = {
  position: "relative", width: 460, maxWidth: "90vw",
  background: "var(--bg-space-1)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 12,
  padding: "28px 28px 24px", display: "flex", flexDirection: "column",
  gap: 16,
};
export const closeBtn: CSSProperties = {
  position: "absolute", top: 10, right: 12, fontSize: 20,
  background: "transparent", color: "var(--text-secondary)",
  border: "none", cursor: "pointer", padding: "0 6px",
};
export const header: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
export const kicker: CSSProperties = {
  fontSize: 10, color: "var(--accent-orange)",
  letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
};
export const kickerPro: CSSProperties = { ...kicker, color: "var(--accent-cream, #F9F0E1)" };
export const title: CSSProperties = {
  margin: 0, fontSize: 22, lineHeight: 1.15, fontWeight: 600,
};
export const priceRow: CSSProperties = { display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 };
export const price: CSSProperties = { fontSize: 32, fontWeight: 700 };
export const priceUnit: CSSProperties = { fontSize: 13, color: "var(--text-secondary)" };
export const featureList: CSSProperties = {
  listStyle: "none", margin: 0, padding: 0, display: "flex",
  flexDirection: "column", gap: 6,
};
export const featureRow: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-start",
  fontSize: 13, color: "var(--text-primary)",
};
export const check: CSSProperties = {
  color: "var(--accent-orange)", fontWeight: 700,
  flexShrink: 0, width: 14, display: "inline-block",
};
export const proLine: CSSProperties = {
  fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5,
};
export const primaryBtn: CSSProperties = {
  padding: "11px 14px", fontSize: 14, fontWeight: 600,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 6, cursor: "pointer",
};
export const primaryBtnDisabled: CSSProperties = {
  ...primaryBtn, opacity: 0.6, cursor: "not-allowed",
};
export const fineprint: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", margin: 0,
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
