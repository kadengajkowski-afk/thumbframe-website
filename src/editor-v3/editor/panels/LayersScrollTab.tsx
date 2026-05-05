import { useUiStore } from "@/state/uiStore";
import { LayerPanel } from "./LayerPanel";

/** Day 61-fix — Layers parchment scroll-tab.
 *
 * Replaces the static bottom LayerPanel with an on-demand scroll
 * that unrolls from the right edge of the viewport, sliding LEFT
 * over the Properties panel. Brass plaque tab is always visible at
 * the right edge; click toggles the scroll. Cmd+L hotkey wired in
 * lib/commands.ts.
 *
 * Architecture:
 *   - Both the tab and the slide-in panel are position:fixed,
 *     z-index above the editor grid (z-index: 5).
 *   - When closed: tab visible, panel translateX(100%) hidden.
 *   - When open: panel translateX(0), 400ms cubic-bezier ease-out.
 *   - LayerPanel rendered inside the panel reuses ALL existing
 *     layer-row logic, dnd, selection, rename. Just wrapped in a
 *     parchment chrome.
 *   - Backdrop overlay (subtle dim) when open; click to close.
 *
 * The tab + panel mount alongside the editor grid (sibling), so
 * removing the bottom layer-panel grid track doesn't affect them. */

const PANEL_WIDTH = 320;
const TAB_WIDTH = 36;

export function LayersScrollTab() {
  const open = useUiStore((s) => s.layersScrollOpen);
  const setOpen = useUiStore((s) => s.setLayersScrollOpen);

  return (
    <>
      {/* ── Brass tab plaque on right edge ──────────────────────── */}
      <button
        type="button"
        aria-label={open ? "Close layers scroll" : "Open layers scroll"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid="layers-scroll-tab"
        style={{
          position: "fixed",
          top: "50%",
          right: open ? PANEL_WIDTH - 1 : 0,
          transform: "translateY(-50%)",
          width: TAB_WIDTH,
          height: 140,
          // Brass plaque: gradient + brass border + cream label
          background: "linear-gradient(to right, var(--wood-mid), var(--wood-light))",
          border: "1.5px solid var(--brass-mid)",
          borderRight: open ? "none" : "1.5px solid var(--brass-mid)",
          borderRadius: open ? "8px 0 0 8px" : "8px 0 0 8px",
          color: "var(--brass-cream)",
          cursor: "pointer",
          padding: 0,
          zIndex: 6,
          boxShadow:
            "inset 0 1px 0 0 var(--brass-bright), " +
            "0 4px 12px -2px rgba(0, 0, 0, 0.45)",
          transition:
            "right 400ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
            "background 200ms ease-out",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 13,
          letterSpacing: "0.08em",
        }}
      >
        {/* Vertical "Layers" label + small scroll icon */}
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ScrollIcon />
          Layers
        </span>
      </button>

      {/* ── Backdrop dim ────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 4,
          background: "rgba(5, 8, 24, 0.30)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 250ms ease-out",
        }}
      />

      {/* ── Parchment scroll panel ──────────────────────────────── */}
      <aside
        aria-label="Layers"
        data-testid="layers-scroll-panel"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 60,
          bottom: 60,
          right: 0,
          width: PANEL_WIDTH,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          // Parchment paper background — warm cream gradient + brass
          // edges to suggest the scroll has wooden rollers at top/bottom.
          background:
            "linear-gradient(to bottom, " +
            "var(--brass-mid) 0px, var(--brass-mid) 14px, " +
            "var(--parchment) 14px, var(--parchment) calc(100% - 14px), " +
            "var(--brass-mid) calc(100% - 14px), var(--brass-mid) 100%)",
          borderLeft: "2px solid var(--brass-mid)",
          boxShadow:
            "-12px 0 28px -8px rgba(0, 0, 0, 0.55), " +
            "inset 1px 0 0 0 var(--brass-bright)",
          color: "var(--brass-shadow)",
          overflow: "hidden",
        }}
      >
        {/* Brass spool detail at top */}
        <div
          style={{
            height: 14,
            background: "linear-gradient(to bottom, var(--brass-bright), var(--brass-mid))",
            borderBottom: "1px solid var(--brass-shadow)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        {/* Header band on parchment */}
        <div
          style={{
            padding: "12px 16px 8px",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 14,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--brass-shadow)",
            borderBottom: "1px solid rgba(160, 101, 30, 0.30)",
            flexShrink: 0,
          }}
        >
          Layers
        </div>
        {/* Layer list — reuses the existing LayerPanel.
            Wrapper inverts the normal dark-on-cream styling so cream
            parchment + brass-shadow text reads natively. */}
        <div
          className="layers-scroll-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            // Day 63 fix — actual baked parchment SVG with cream
            // fallback color so the slide-in panel reads as paper,
            // not flat color block.
            backgroundColor: "var(--parchment)",
            backgroundImage: "url(\"/quarters/parchment-scroll.png\")",
            backgroundSize: "400px 400px",
            backgroundRepeat: "repeat",
            color: "var(--brass-shadow)",
          }}
        >
          <LayerPanel />
        </div>
        {/* Brass spool detail at bottom */}
        <div
          style={{
            height: 14,
            background: "linear-gradient(to top, var(--brass-bright), var(--brass-mid))",
            borderTop: "1px solid var(--brass-shadow)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      </aside>
    </>
  );
}

function ScrollIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 3 Q2 2 3 2 H10 Q12 2 12 4 V10 Q12 12 10 12 H3 Q2 12 2 11 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2 3 Q4 2 6 3 Q8 2 10 3 Q12 2 12 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.7"
      />
    </svg>
  );
}
