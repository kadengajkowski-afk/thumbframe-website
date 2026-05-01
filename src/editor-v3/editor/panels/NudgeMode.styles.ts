import type { CSSProperties } from "react";

/** Day 44 — Nudge tab styles. Lives next to ThumbFriendPanel.styles
 * so the panel-level tokens (bubble radii, accent color) stay
 * consistent — the nudge card reads as a sibling of the assistant
 * bubbles, not a foreign visual. */

export const wrap: CSSProperties = {
  flex: 1, minHeight: 0,
  display: "flex", flexDirection: "column",
  overflow: "hidden",
};

export const controls: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 8, padding: "10px 14px",
  borderBottom: "1px solid var(--border-ghost)",
  flexWrap: "wrap",
};

export const status: CSSProperties = {
  fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  display: "inline-flex", alignItems: "center", gap: 6,
};
export const statusDot: CSSProperties = {
  display: "inline-block", width: 6, height: 6, borderRadius: 3,
  background: "var(--text-secondary)",
};
export const statusDotActive: CSSProperties = {
  ...statusDot,
  background: "var(--accent-orange)",
  animation: "tf-pulse 1.4s ease-in-out infinite",
};
export const statusDotIdle: CSSProperties = {
  ...statusDot,
  background: "var(--accent-cream, #F9F0E1)",
  opacity: 0.5,
};

export const controlGroup: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
};

export const toggle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 8px", fontSize: 10, letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)", borderRadius: 12,
  cursor: "pointer", fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const toggleActive: CSSProperties = {
  ...toggle,
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  borderColor: "var(--accent-orange)",
  fontWeight: 600,
};

export const scroller: CSSProperties = {
  flex: 1, minHeight: 0, overflowY: "auto",
  padding: "12px 14px",
  display: "flex", flexDirection: "column", gap: 12,
};

export const empty: CSSProperties = {
  alignSelf: "center",
  margin: "auto 0",
  fontSize: 12, color: "var(--text-secondary)",
  textAlign: "center",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.04em",
};

export const card: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8,
  padding: 12,
  background: "var(--bg-space-0)",
  border: "1px solid var(--accent-orange)",
  borderRadius: 10,
};
export const cardDismissed: CSSProperties = {
  ...card,
  borderColor: "var(--border-ghost)",
  opacity: 0.55,
};
export const cardApplied: CSSProperties = {
  ...card,
  borderColor: "var(--accent-cream, #F9F0E1)",
};

export const cardHead: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
};
export const cardCrew: CSSProperties = {
  fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const cardType: CSSProperties = {
  marginLeft: "auto",
  fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--accent-orange)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

export const cardTitle: CSSProperties = {
  margin: 0, fontSize: 14, lineHeight: 1.3, fontWeight: 600,
  color: "var(--text-primary)",
};
export const cardBody: CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: 1.45,
  color: "var(--accent-cream, #F9F0E1)",
};

export const actions: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4,
};
export const applyBtn: CSSProperties = {
  padding: "5px 12px", fontSize: 11, fontWeight: 600,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 6, cursor: "pointer",
};
export const tellMeBtn: CSSProperties = {
  padding: "5px 12px", fontSize: 11,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
export const dismissBtn: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "transparent", color: "var(--text-secondary)",
  border: "none", cursor: "pointer",
};
export const statusTag: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.06em", textTransform: "uppercase",
  marginTop: 2,
};

export const historyToggle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "4px 0", fontSize: 11,
  background: "transparent", color: "var(--text-secondary)",
  border: "none", cursor: "pointer",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.04em",
};

export const historyList: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
};

export const pauseMenu: CSSProperties = {
  position: "absolute",
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  padding: 4, display: "flex", flexDirection: "column",
  zIndex: 5, minWidth: 160,
};
export const pauseItem: CSSProperties = {
  padding: "6px 10px", fontSize: 11,
  background: "transparent", color: "var(--text-primary)",
  border: "none", textAlign: "left", cursor: "pointer", borderRadius: 4,
};
