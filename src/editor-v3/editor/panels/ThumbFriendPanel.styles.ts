import type { CSSProperties } from "react";

/** Day 39 — ThumbFriendPanel styles. Day 64d cream-parchment pass:
 * the panel previously rendered on dark space-bg with cream text.
 * Per design feedback, illegible against the new wood-quarters
 * chrome. Switched to a parchment-PNG background with ink text +
 * brass accents, matching the LayersScrollTab + menubar dropdowns
 * so the right-side panels read as the same paper world. */

const PARCHMENT_BG: CSSProperties["background"] = "var(--parchment)";
const PARCHMENT_IMG = "url('/quarters/parchment-scroll.png')";

export const wrap: CSSProperties = {
  flex: "0 0 360px",
  width: 360, maxWidth: 360,
  height: "100%", minHeight: 0,
  display: "flex", flexDirection: "column",
  backgroundColor: "var(--parchment)",
  backgroundImage: PARCHMENT_IMG,
  backgroundSize: "400px 400px",
  backgroundRepeat: "repeat",
  color: "var(--ink)",
  borderLeft: "1px solid rgba(184, 134, 75, 0.5)",
  overflow: "hidden",
};
export const header: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid rgba(184, 134, 75, 0.4)",
};
export const headerLabel: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontVariant: "small-caps",
  fontSize: 13, color: "var(--ink)",
  letterSpacing: "0.06em", fontWeight: 500,
};
export const closeBtn: CSSProperties = {
  fontSize: 16, padding: "0 4px",
  background: "transparent", color: "var(--ink)",
  border: "none", cursor: "pointer", opacity: 0.7,
};
export const tabs: CSSProperties = {
  display: "flex", padding: "0 8px",
  borderBottom: "1px solid rgba(184, 134, 75, 0.4)",
};
export const tab: CSSProperties = {
  flex: 1, padding: "10px 0",
  fontFamily: "var(--font-serif)",
  fontVariant: "small-caps",
  fontSize: 12, letterSpacing: "0.06em",
  background: "transparent", color: "rgba(42, 38, 32, 0.55)",
  borderTop: "none", borderLeft: "none", borderRight: "none",
  borderBottomWidth: 2, borderBottomStyle: "solid",
  borderBottomColor: "transparent",
  cursor: "pointer",
};
export const tabActive: CSSProperties = {
  ...tab, color: "var(--brass)",
  borderBottomColor: "var(--brass)",
  fontWeight: 600,
};
export const stub: CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, color: "rgba(42, 38, 32, 0.6)",
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
  fontSize: 13, color: "var(--ink)",
  textAlign: "center", margin: "12px 0 4px",
};
export const emptySub: CSSProperties = {
  fontSize: 11, color: "rgba(42, 38, 32, 0.6)",
  textAlign: "center", margin: 0,
};
export const chipRow: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14,
};
export const chip: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "var(--brass-cream)",
  color: "var(--brass-shadow)",
  border: "1px solid rgba(184, 134, 75, 0.4)",
  borderRadius: 14,
  cursor: "pointer",
};
export const userBubble: CSSProperties = {
  alignSelf: "flex-end", maxWidth: "82%",
  padding: "8px 12px", fontSize: 13, lineHeight: 1.4,
  background: "var(--brass-shadow)",
  color: "var(--cream-100)",
  borderRadius: "14px 14px 4px 14px",
  whiteSpace: "pre-wrap", wordBreak: "break-word",
};
export const assistantBubble: CSSProperties = {
  alignSelf: "flex-start", maxWidth: "82%",
  padding: "8px 12px", fontSize: 13, lineHeight: 1.4,
  background: "rgba(255, 244, 224, 0.5)",
  color: "var(--ink)",
  border: "1px solid rgba(184, 134, 75, 0.35)",
  borderRadius: "14px 14px 14px 4px",
  whiteSpace: "pre-wrap", wordBreak: "break-word",
};
export const slashBubble: CSSProperties = {
  alignSelf: "center",
  maxWidth: "92%",
  padding: "4px 0",
  fontSize: 11,
  lineHeight: 1.4,
  textAlign: "center",
  color: "rgba(42, 38, 32, 0.6)",
  fontStyle: "italic",
  letterSpacing: 0.2,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "transparent",
  border: "none",
  borderTop: "1px solid rgba(120, 90, 40, 0.2)",
  borderBottom: "1px solid rgba(120, 90, 40, 0.2)",
  margin: "4px 8px",
};
export const cursor: CSSProperties = {
  display: "inline-block", width: 6, height: 12,
  background: "var(--ink)",
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
  background: "var(--accent-orange)", color: "var(--cream-100)",
  border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
};
export const inputWrap: CSSProperties = {
  position: "relative",
  borderTop: "1px solid rgba(184, 134, 75, 0.4)",
  padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
  backgroundColor: "var(--parchment-shadow)",
};
export const inputRow: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-end",
};
export const textarea: CSSProperties = {
  flex: 1, padding: "8px 10px", fontSize: 13, lineHeight: 1.4,
  background: "rgba(255, 244, 224, 0.6)",
  color: "var(--ink)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 8,
  resize: "none", fontFamily: "inherit",
};
/* Day 64d — Send button matches the Ship It pill: brass-cream
 * interior, brass-mid border, ink-shadow text. */
export const sendBtn: CSSProperties = {
  padding: "8px 16px", fontSize: 12, fontWeight: 700,
  background: "var(--brass-cream)",
  color: "var(--brass-shadow)",
  border: "1.5px solid var(--brass-mid)",
  borderRadius: 999,
  cursor: "pointer", flexShrink: 0,
  letterSpacing: "0.02em",
  boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.45)",
};
export const sendBtnDisabled: CSSProperties = {
  ...sendBtn, opacity: 0.5, cursor: "not-allowed",
};
export const meta: CSSProperties = {
  fontSize: 10, color: "rgba(42, 38, 32, 0.55)",
  letterSpacing: "0.04em", display: "flex",
  justifyContent: "space-between", fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const proPill: CSSProperties = {
  padding: "1px 6px", borderRadius: 8,
  background: "var(--brass)", color: "var(--cream-100)",
  fontWeight: 600, letterSpacing: "0.06em",
};
export const slashDropdown: CSSProperties = {
  position: "absolute", left: 12, right: 12, bottom: 56,
  maxHeight: 200, overflowY: "auto",
  background: "var(--parchment)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 5,
};
export const slashItem: CSSProperties = {
  padding: "8px 10px", fontSize: 12, color: "var(--ink)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  cursor: "pointer", borderBottom: "1px solid rgba(120, 90, 40, 0.2)",
};
export const slashItemActive: CSSProperties = {
  ...slashItem, background: "rgba(184, 134, 75, 0.12)",
};
export const slashHint: CSSProperties = {
  color: "rgba(42, 38, 32, 0.55)", fontSize: 11,
};
export const keyframes = `@keyframes tf-blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }`;

// ── Day 40 — tool-call list ─────────────────────────────────────────

export const slashChip: CSSProperties = {
  display: "inline-block",
  margin: "2px 0",
  padding: "2px 8px",
  fontSize: 12,
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  background: "var(--brass-cream)",
  color: "var(--brass-shadow)",
  border: "1px solid var(--brass)",
  borderRadius: 4,
  cursor: "pointer",
};

export const toolList: CSSProperties = {
  alignSelf: "flex-start", maxWidth: "82%",
  display: "flex", flexDirection: "column", gap: 4,
  padding: "6px 0",
};
const toolRowBase: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 6,
  fontSize: 11, lineHeight: 1.4,
  fontFamily: '"Geist Mono", ui-monospace, monospace',
  color: "rgba(42, 38, 32, 0.65)",
};
export const toolRowPending: CSSProperties = { ...toolRowBase };
export const toolRowOk: CSSProperties = { ...toolRowBase, color: "var(--ink)" };
export const toolRowFail: CSSProperties = { ...toolRowBase, color: "var(--accent-orange)" };
export const toolGlyph: CSSProperties = {
  display: "inline-block", minWidth: 12, textAlign: "center", fontWeight: 700,
};
export const toolText: CSSProperties = { flex: 1 };
export const toolError: CSSProperties = { color: "var(--accent-orange)", fontStyle: "italic" };
export const toolActionsRow: CSSProperties = {
  display: "flex", gap: 6, marginTop: 4,
};
export const acceptBtn: CSSProperties = {
  padding: "4px 10px", fontSize: 11, fontWeight: 600,
  background: "var(--brass)", color: "var(--cream-100)",
  border: "none", borderRadius: 4, cursor: "pointer",
};
export const rejectBtn: CSSProperties = {
  padding: "4px 10px", fontSize: 11,
  background: "transparent", color: "var(--ink)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 4, cursor: "pointer",
};
export const undoBtn: CSSProperties = {
  alignSelf: "flex-start", marginTop: 2,
  padding: "3px 8px", fontSize: 10,
  background: "transparent", color: "rgba(42, 38, 32, 0.7)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 4, cursor: "pointer",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

// ── Day 40 — preview toggle in header ───────────────────────────────

export const previewToggle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 8px", fontSize: 10, letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "transparent", color: "rgba(42, 38, 32, 0.7)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 12,
  cursor: "pointer", fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const previewToggleActive: CSSProperties = {
  ...previewToggle,
  background: "var(--brass)",
  color: "var(--cream-100)",
  borderColor: "var(--brass)",
  fontWeight: 600,
};
export const headerLeft: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  flexWrap: "wrap",
};

export const clearBtn: CSSProperties = {
  fontSize: 11, padding: "2px 8px",
  background: "transparent", color: "rgba(42, 38, 32, 0.7)",
  border: "1px solid rgba(184, 134, 75, 0.4)", borderRadius: 10,
  cursor: "pointer",
  letterSpacing: "0.04em",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

// ── Days 41-42 — crew label + intro card ────────────────────────────

export const crewLabel: CSSProperties = {
  alignSelf: "flex-start",
  display: "inline-flex", alignItems: "center", gap: 4,
  marginTop: 4, marginBottom: -2,
  fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "rgba(42, 38, 32, 0.55)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};
export const introCard: CSSProperties = {
  margin: "8px 0", padding: 14,
  background: "rgba(255, 244, 224, 0.55)",
  color: "var(--ink)",
  border: "1px solid var(--brass)", borderRadius: 8,
  display: "flex", flexDirection: "column", gap: 6,
};
export const introHeader: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
};
export const introName: CSSProperties = { fontSize: 13, fontWeight: 600 };
export const introLine: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: 1.4,
};
export const introLineMuted: CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: 1.4, color: "rgba(42, 38, 32, 0.6)",
};
export const introDismiss: CSSProperties = {
  alignSelf: "flex-start", marginTop: 4,
  padding: "6px 14px", fontSize: 12, fontWeight: 700,
  background: "var(--brass-cream)", color: "var(--brass-shadow)",
  border: "1.5px solid var(--brass-mid)", borderRadius: 999, cursor: "pointer",
  letterSpacing: "0.02em",
};
