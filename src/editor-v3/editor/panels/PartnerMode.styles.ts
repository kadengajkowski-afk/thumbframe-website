import type { CSSProperties } from "react";

/** Day 45 — Partner mode styles. Inherits the chat bubble look from
 * ThumbFriendPanel.styles (cream-on-dark) but adds plan-card chrome,
 * a stage indicator, starter-prompt chips, and a session-counter
 * line in the meta footer. */

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

export const stageRow: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

export const stageDot: CSSProperties = {
  display: "inline-block", width: 6, height: 6, borderRadius: 3,
  background: "var(--accent-orange)",
};

export const stageDotIdle: CSSProperties = {
  ...stageDot,
  background: "var(--text-secondary)",
  opacity: 0.5,
};

export const controlGroup: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
};

export const toggle: CSSProperties = {
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
  display: "flex", flexDirection: "column", gap: 10,
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

export const localNote: CSSProperties = {
  ...assistantBubble,
  background: "transparent",
  color: "var(--text-secondary)",
  fontStyle: "italic",
  border: "1px dashed var(--border-ghost)",
};

export const crewLabel: CSSProperties = {
  alignSelf: "flex-start",
  display: "inline-flex", alignItems: "center", gap: 4,
  marginTop: 4, marginBottom: -2,
  fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

// ── Plan card ──────────────────────────────────────────────────────

export const planCard: CSSProperties = {
  alignSelf: "stretch",
  display: "flex", flexDirection: "column", gap: 8,
  padding: 12,
  background: "var(--bg-space-0)",
  border: "1px solid var(--accent-orange)",
  borderRadius: 10,
};
export const planCardExecuted: CSSProperties = {
  ...planCard,
  borderColor: "var(--accent-cream, #F9F0E1)",
};
export const planCardRejected: CSSProperties = {
  ...planCard,
  borderColor: "var(--border-ghost)",
  opacity: 0.6,
};

export const planTitle: CSSProperties = {
  margin: 0, fontSize: 13, fontWeight: 600,
  color: "var(--text-primary)",
};
export const planStepsList: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  margin: 0, padding: 0, listStyle: "none",
};
export const planStep: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 6,
  fontSize: 12, lineHeight: 1.4,
  color: "var(--accent-cream, #F9F0E1)",
};
export const planStepGlyph: CSSProperties = {
  display: "inline-block", minWidth: 14, textAlign: "center",
  color: "var(--accent-orange)", fontWeight: 700,
};
export const planStepDescription: CSSProperties = {
  flex: 1,
};
export const planStepTool: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  marginLeft: 4,
};

export const planActions: CSSProperties = {
  display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4,
};
export const approveBtn: CSSProperties = {
  padding: "6px 14px", fontSize: 12, fontWeight: 600,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  border: "none", borderRadius: 6, cursor: "pointer",
};
export const editBtn: CSSProperties = {
  padding: "6px 12px", fontSize: 12,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
export const rejectBtn: CSSProperties = {
  padding: "6px 12px", fontSize: 12,
  background: "transparent", color: "var(--text-secondary)",
  border: "none", cursor: "pointer",
};

export const planStatusTag: CSSProperties = {
  fontSize: 10, color: "var(--text-secondary)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  letterSpacing: "0.06em", textTransform: "uppercase",
};

export const editForm: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, marginTop: 6,
};
export const editTextarea: CSSProperties = {
  padding: "6px 10px", fontSize: 12, lineHeight: 1.4,
  background: "var(--bg-space-1)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  resize: "none", fontFamily: "inherit", minHeight: 60,
};

// ── Empty state with starter prompts ───────────────────────────────

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
export const starterRow: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, marginTop: 14,
};
export const starterChip: CSSProperties = {
  padding: "8px 12px", fontSize: 12,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 8,
  cursor: "pointer", textAlign: "left",
};

// ── Input ──────────────────────────────────────────────────────────

export const inputWrap: CSSProperties = {
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
