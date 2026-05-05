import { type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { useEffect, useState } from "react";

/** Day 64c — bottom wall content. Minimal layout:
 *
 *   LEFT:  "Saved Ns ago" status (Fraunces italic, cream-soft)
 *   RIGHT: zoom controls — minus pill / percent / plus pill (brass)
 *
 *  Mounted inside the bottom WoodWall. The wall paints the wood;
 *  this is transparent decoration on top. Height: 38px to match
 *  EditorShell's bottom row. */

export function BottomBar() {
  const saveStatus = useUiStore((s) => s.saveStatus);
  const zoomScale = useUiStore((s) => s.zoomScale);
  const setZoomScale = useUiStore((s) => s.setZoomScale);

  const [agoText, setAgoText] = useState("");
  // Live "Saved Ns ago" updater — only when status is `saved`.
  useEffect(() => {
    if (saveStatus.kind !== "saved") {
      setAgoText("");
      return;
    }
    const at = saveStatus.at;
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
      if (sec < 5) setAgoText("Saved just now");
      else if (sec < 60) setAgoText(`Saved ${sec}s ago`);
      else if (sec < 3600) setAgoText(`Saved ${Math.floor(sec / 60)}m ago`);
      else setAgoText(`Saved ${Math.floor(sec / 3600)}h ago`);
    };
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, [saveStatus]);

  const statusText =
    saveStatus.kind === "saving" ? "Saving…" :
    saveStatus.kind === "error"  ? "Save error" :
                                   agoText;

  const zoomPct = Math.round(zoomScale * 100);
  const stepZoom = (delta: number) => {
    const next = Math.max(0.1, Math.min(8, zoomScale + delta));
    setZoomScale(next);
  };

  return (
    <div style={bar} data-alive="bottom-bar">
      <div style={leftGroup}>
        <span style={statusLabel}>{statusText}</span>
      </div>
      <div style={rightGroup}>
        <button type="button" onClick={() => stepZoom(-0.1)} style={zoomBtn} aria-label="Zoom out">−</button>
        <span style={zoomReadout}>{zoomPct}%</span>
        <button type="button" onClick={() => stepZoom(0.1)} style={zoomBtn} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}

const bar: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  padding: "0 16px",
  gap: 12,
  background: "transparent",
  borderTop: "1px solid rgba(160, 101, 30, 0.55)",
  boxShadow: "inset 0 1px 0 0 var(--brass-bright)",
  color: "var(--brass-cream)",
};

const leftGroup: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const rightGroup: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const statusLabel: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 12,
  letterSpacing: "0.01em",
  color: "var(--cream-soft, rgba(244, 234, 213, 0.55))",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const zoomBtn: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--brass)",
  color: "var(--ink)",
  border: "1px solid var(--brass-shadow)",
  borderRadius: 999,
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
};

const zoomReadout: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--brass-cream)",
  minWidth: 38,
  textAlign: "center",
};
