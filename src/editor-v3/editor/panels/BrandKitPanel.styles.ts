import type { CSSProperties } from "react";

/** Day 31 — BrandKitPanel inline styles. Split out so the panel
 * component file stays under the 250-line ceiling. */

export const backdrop: CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};
export const card: CSSProperties = {
  width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column",
  background: "var(--bg-space-2)", border: "1px solid var(--border-ghost)",
  borderRadius: 10, padding: "20px 22px", color: "var(--text-primary)",
  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
  overflowY: "auto",
};
export const cardHeader: CSSProperties = {
  fontSize: 16, fontWeight: 600,
  color: "var(--accent-cream)", marginBottom: 6,
};
export const subtitle: CSSProperties = {
  fontSize: 13, color: "var(--text-secondary)", marginBottom: 14,
};
export const inputRow: CSSProperties = { display: "flex", gap: 8, marginBottom: 12 };
export const textInput: CSSProperties = {
  flex: 1, padding: "8px 10px",
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  fontSize: 13,
};
export const submitBtn: CSSProperties = {
  padding: "8px 14px", background: "var(--accent-orange)",
  color: "var(--bg-space-0)", border: "none", borderRadius: 6,
  fontWeight: 600, fontSize: 13, cursor: "pointer",
};
export const loadingBlock: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: 14, color: "var(--text-secondary)", fontSize: 13,
};
export const spinner: CSSProperties = {
  width: 16, height: 16, borderRadius: "50%",
  border: "2px solid var(--border-ghost)",
  borderTopColor: "var(--accent-cream)",
  animation: "brand-spin 0.7s linear infinite",
};
export const errorBlock: CSSProperties = {
  padding: 12, marginBottom: 8,
  background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.4)",
  borderRadius: 6, color: "#FFB4B4", fontSize: 13,
};
export const resultWrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 14, marginTop: 4,
};
export const channelHeader: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
};
export const avatar: CSSProperties = {
  width: 56, height: 56, borderRadius: "50%", objectFit: "cover",
  border: "1px solid var(--border-ghost)",
};
export const avatarPlaceholder: CSSProperties = {
  width: 56, height: 56, borderRadius: "50%",
  background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--text-secondary)",
};
export const channelText: CSSProperties = { flex: 1, minWidth: 0 };
export const channelName: CSSProperties = { fontSize: 15, fontWeight: 600 };
export const channelHandle: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)", marginTop: 2,
};
export const channelStats: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)", marginTop: 2,
};
export const section: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
export const sectionLabel: CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: 0.5, color: "var(--text-secondary)",
};
export const swatchRow: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 8,
};
export const swatchBox: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
};
export const swatchChip: CSSProperties = {
  width: 44, height: 44, borderRadius: 6,
};
export const swatchLabel: CSSProperties = {
  fontSize: 10, fontFamily: "var(--font-mono, monospace)",
  color: "var(--text-secondary)",
};
export const thumbStrip: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
};
export const thumbImg: CSSProperties = {
  width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 4,
  background: "var(--bg-space-0)",
};
export const emptyHint: CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic",
};
export const cancelBtn: CSSProperties = {
  marginTop: 16, padding: "8px 14px", alignSelf: "flex-end",
  background: "transparent", border: "1px solid var(--border-ghost)",
  color: "var(--text-secondary)", borderRadius: 6, fontSize: 13, cursor: "pointer",
};

// ── Day 32 additions ───────────────────────────────────────────────────────
export const tabRow: CSSProperties = {
  display: "flex", gap: 4, marginBottom: 12,
  borderBottom: "1px solid var(--border-ghost)",
};
const tabBase: CSSProperties = {
  padding: "8px 14px", fontSize: 13,
  background: "transparent", border: "none", cursor: "pointer",
  color: "var(--text-secondary)",
  borderBottom: "2px solid transparent",
  marginBottom: -1,
};
export const tabBtn: CSSProperties = { ...tabBase };
export const tabBtnActive: CSSProperties = {
  ...tabBase,
  color: "var(--accent-cream)",
  borderBottomColor: "var(--accent-cream)",
};

const pinBtnBase: CSSProperties = {
  padding: "6px 10px", fontSize: 12, fontWeight: 600,
  borderRadius: 6, cursor: "pointer", flexShrink: 0,
};
export const pinBtn: CSSProperties = {
  ...pinBtnBase,
  background: "transparent", color: "var(--accent-cream)",
  border: "1px solid var(--accent-cream)",
};
export const pinBtnActive: CSSProperties = {
  ...pinBtnBase,
  background: "var(--accent-cream)", color: "var(--bg-space-0)",
  border: "1px solid var(--accent-cream)",
};

export const savedList: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  maxHeight: "55vh", overflowY: "auto",
};
export const savedRow: CSSProperties = {
  position: "relative",
  display: "flex", alignItems: "stretch",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  background: "var(--bg-space-0)",
};
export const savedRowOpen: CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", gap: 10,
  padding: 8, background: "transparent", border: "none",
  color: "var(--text-primary)", cursor: "pointer", textAlign: "left",
};
export const savedAvatar: CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", objectFit: "cover",
  border: "1px solid var(--border-ghost)", flexShrink: 0,
};
export const savedAvatarPlaceholder: CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  border: "1px solid var(--border-ghost)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--text-secondary)", flexShrink: 0,
};
export const savedText: CSSProperties = { flex: 1, minWidth: 0 };
export const savedTitle: CSSProperties = {
  fontSize: 13, fontWeight: 600,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
export const savedHandle: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
export const savedSwatches: CSSProperties = {
  display: "flex", gap: 3, flexShrink: 0,
};
export const savedSwatch: CSSProperties = {
  width: 14, height: 14, borderRadius: 3,
  border: "1px solid var(--border-ghost)",
};
export const savedDelete: CSSProperties = {
  padding: "0 12px", background: "transparent", border: "none",
  borderLeft: "1px solid var(--border-ghost)",
  color: "var(--text-secondary)", fontSize: 18, cursor: "pointer",
};

// ── Day 33: Fonts section ──────────────────────────────────────────────────
export const fontGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
};
export const fontCard: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  padding: "10px 12px",
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  color: "var(--text-primary)",
  cursor: "pointer", textAlign: "left",
};
export const fontCardName: CSSProperties = {
  fontSize: 14, fontWeight: 600, lineHeight: 1.1,
};
export const fontCardSample: CSSProperties = {
  fontSize: 18, lineHeight: 1.2, color: "var(--accent-cream)",
};
export const fontCardConfidence: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 10, color: "var(--text-secondary)",
};
export const confidenceDot: CSSProperties = {
  width: 6, height: 6, borderRadius: "50%",
  background: "var(--accent-cream)",
};
export const reextractLink: CSSProperties = {
  marginLeft: 8,
  padding: "1px 6px",
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 3,
  color: "var(--text-secondary)",
  fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase",
  cursor: "pointer",
};
