import type { CSSProperties } from "react";

/** Day 20 — AuthPanel styles split out so the panel TSX stays
 * under the 200-line spec ceiling. */

export const backdrop: CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};
export const card: CSSProperties = {
  width: 380, background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)", borderRadius: 10,
  padding: "24px 22px", color: "var(--text-primary)",
  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
};
export const header: CSSProperties = {
  fontSize: 18, fontWeight: 600,
  color: "var(--accent-cream)", marginBottom: 8,
};
export const subtitle: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)",
  margin: "0 0 18px 0", lineHeight: 1.5,
};
export const warnBox: CSSProperties = {
  fontSize: 11, color: "var(--accent-orange)", marginBottom: 14,
  padding: "8px 10px", border: "1px solid var(--accent-orange)",
  borderRadius: 5, lineHeight: 1.4,
};
export const oauthBtn: CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
  gap: 10, padding: "10px 12px", background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  color: "var(--text-primary)", fontSize: 13, fontWeight: 500,
  cursor: "pointer",
};
export const googleMark: CSSProperties = {
  width: 18, height: 18, borderRadius: "50%",
  background: "linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 100%)",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  color: "white", fontSize: 11, fontWeight: 700,
};
export const divider: CSSProperties = {
  textAlign: "center", margin: "16px 0", fontSize: 11,
  color: "var(--text-secondary)", letterSpacing: "0.04em",
};
export const label: CSSProperties = {
  display: "block", fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase",
};
export const input: CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  borderRadius: 6, color: "var(--text-primary)", fontSize: 13,
  marginBottom: 12,
};
export const primaryBtn: CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "var(--accent-orange)", border: "none", borderRadius: 6,
  color: "var(--bg-space-0)", fontWeight: 600, fontSize: 13,
  cursor: "pointer",
};
export const successBox: CSSProperties = {
  fontSize: 12, color: "var(--accent-cream)", lineHeight: 1.5,
  padding: "10px 12px", background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
};
export const errorBox: CSSProperties = {
  fontSize: 11, color: "var(--accent-orange)", marginTop: 12,
  padding: "8px 10px", lineHeight: 1.4,
};
export const cancelBtn: CSSProperties = {
  marginTop: 16, width: "100%", padding: "8px 14px",
  background: "transparent", border: "1px solid var(--border-ghost)",
  borderRadius: 6, color: "var(--text-secondary)", fontSize: 12,
  cursor: "pointer",
};
