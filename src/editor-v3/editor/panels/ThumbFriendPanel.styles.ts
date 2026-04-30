import type { CSSProperties } from "react";

/** Day 39 — ThumbFriendPanel styles split out so the .tsx stays
 * under the 300-line spec ceiling. iMessage-inspired bubbles —
 * cream text on muted dark fills, subtle rounded radii, no chrome. */

export const wrap: CSSProperties = {
  width: 360, minWidth: 360, height: "100%",
  display: "flex", flexDirection: "column",
  background: "var(--bg-space-1)",
  borderLeft: "1px solid var(--border-ghost)",
};
export const header: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid var(--border-ghost)",
};
export const headerLabel: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)",
  letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
};
export const closeBtn: CSSProperties = {
  fontSize: 16, padding: "0 4px",
  background: "transparent", color: "var(--text-secondary)",
  border: "none", cursor: "pointer",
};
export const tabs: CSSProperties = {
  display: "flex", padding: "0 8px",
  borderBottom: "1px solid var(--border-ghost)",
};
export const tab: CSSProperties = {
  flex: 1, padding: "10px 0", fontSize: 12,
  background: "transparent", color: "var(--text-secondary)",
  borderTop: "none", borderLeft: "none", borderRight: "none",
  borderBottomWidth: 2, borderBottomStyle: "solid",
  borderBottomColor: "transparent",
  cursor: "pointer", letterSpacing: "0.04em",
};
export const tabActive: CSSProperties = {
  ...tab, color: "var(--text-primary)",
  borderBottomColor: "var(--accent-orange)",
};
export const stub: CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.04em", padding: 24, textAlign: "center",
};
export const scroller: CSSProperties = {
  flex: 1, minHeight: 0, overflowY: "auto",
  padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
};
export const empty: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 12,
  alignItems: "stretch", padding: "8px 0",
};
export const emptyTitle: CSSProperties = {
  fontSize: 13, color: "var(--text-primary)",
  textAlign: "center", margin: "12px 0 4px",
};
export const emptySub: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", margin: 0,
};
export const chipRow: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14,
};
export const chip: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "var(--bg-space-0)", color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)", borderRadius: 14,
  cursor: "pointer",
};
export const userBubble: CSSProperties = {
  alignSelf: "flex-end", maxWidth: "82%",
  padding: "8px 12px", fontSize: 13, lineHeight: 1.4,
  background: "var(--bg-space-2, #2a2f3a)",
  color: "var(--accent-cream, #F9F0E1)",
  borderRadius: "14px 14px 4px 14px",
  whiteSpace: "pre-wrap", wordBreak: "break-word",
};
export const assistantBubble: CSSProperties = {
  alignSelf: "flex-start", maxWidth: "82%",
  padding: "8px 12px", fontSize: 13, lineHeight: 1.4,
  background: "var(--bg-space-1)",
  color: "var(--accent-cream, #F9F0E1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: "14px 14px 14px 4px",
  whiteSpace: "pre-wrap", wordBreak: "break-word",
};
export const slashBubble: CSSProperties = {
  ...assistantBubble,
  background: "transparent",
  color: "var(--text-secondary)",
  fontStyle: "italic",
  border: "1px dashed var(--border-ghost)",
};
export const cursor: CSSProperties = {
  display: "inline-block", width: 6, height: 12,
  background: "var(--accent-cream, #F9F0E1)",
  marginLeft: 2, animation: "tf-blink 1s steps(2) infinite",
  verticalAlign: "middle",
};
export const errorRow: CSSProperties = {
  fontSize: 12, color: "var(--accent-orange)",
  padding: "8px 12px",
  border: "1px solid var(--accent-orange)",
  borderRadius: 6, alignSelf: "flex-start", maxWidth: "100%",
};
export const errorBtn: CSSProperties = {
  marginLeft: 6, padding: "2px 8px", fontSize: 11,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
};
export const inputWrap: CSSProperties = {
  position: "relative",
  borderTop: "1px solid var(--border-ghost)",
  padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
};
export const inputRow: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-end",
};
export const textarea: CSSProperties = {
  flex: 1, padding: "8px 10px", fontSize: 13, lineHeight: 1.4,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 8,
  resize: "none", fontFamily: "inherit",
};
export const sendBtn: CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 600,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0,
};
export const sendBtnDisabled: CSSProperties = {
  ...sendBtn, opacity: 0.5, cursor: "not-allowed",
};
export const meta: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  letterSpacing: "0.04em", display: "flex",
  justifyContent: "space-between", fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const proPill: CSSProperties = {
  padding: "1px 6px", borderRadius: 8,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  fontWeight: 600, letterSpacing: "0.06em",
};
export const slashDropdown: CSSProperties = {
  position: "absolute", left: 12, right: 12, bottom: 56,
  maxHeight: 200, overflowY: "auto",
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 5,
};
export const slashItem: CSSProperties = {
  padding: "8px 10px", fontSize: 12,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  cursor: "pointer", borderBottom: "1px solid var(--border-ghost)",
};
export const slashItemActive: CSSProperties = {
  ...slashItem, background: "var(--bg-space-1)",
};
export const slashHint: CSSProperties = {
  color: "var(--text-secondary)", fontSize: 11,
};
export const keyframes = `@keyframes tf-blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }`;
