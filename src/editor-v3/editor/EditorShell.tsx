import { Suspense, lazy, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TextEditor } from "@/editor/TextEditor";
import { BgRemoveOverlay } from "@/editor/BgRemoveOverlay";
import { TopBar } from "@/editor/panels/TopBar";
import { LayersScrollTab } from "@/editor/panels/LayersScrollTab";
import { ZoomIndicator } from "@/editor/ZoomIndicator";
import { ToolPalette } from "@/editor/panels/ToolPalette";
import { PreviewRack } from "@/editor/panels/PreviewRack";
import { PastDueBanner } from "@/editor/panels/PastDueBanner";
import { BottomBar } from "@/editor/panels/BottomBar";
import { ThumbFriendBubble } from "@/editor/panels/ThumbFriendBubble";
import { WoodWall } from "@/editor/walls/WoodWall";
import { MenuBar } from "@/editor/menubar/MenuBar";

const ThumbFriendPanel = lazy(() =>
  import("@/editor/panels/ThumbFriendPanel").then((m) => ({ default: m.ThumbFriendPanel })),
);

/** Day 64a — EditorShell. 64c update:
 *
 *  Grid template now carries a 32px MENUBAR row between the topwall
 *  and the canvas row, and locks the right wall column to 64px.
 *  The Properties (ContextPanel) panel is gone — the right wall is
 *  decorative wood + porthole + the LayersScrollTab brass plaque.
 *  PreviewRack and ThumbFriendPanel still open via their hotkeys
 *  but render as fixed-position overlays anchored to the right edge
 *  of the viewport (slide over the canvas + right wall, not inside
 *  the grid). This keeps the grid columns stable at 64 / 1fr / 64.
 *
 *  Grid (5 named cells):
 *    "topwall    topwall  topwall"     38px
 *    "menubar    menubar  menubar"     32px
 *    "leftwall   canvas   rightwall"   1fr
 *    "bottomwall bottomwall bottomwall" 38px
 *    / 64px 1fr 64px;
 */

export function EditorShell() {
  const cursor = useUiStore(deriveCursor);
  const previewOpen = useUiStore((s) => s.previewRackOpen);
  const thumbfriendOpen = useUiStore((s) => s.thumbfriendPanelOpen);

  return (
    <div style={editorGrid}>
      <PastDueBanner />

      {/* TOP WALL — small porthole top-center. Spec said 38px but
          TopBar internals (avatar 28 + button padding) are tuned for
          48; shrinking would clip the user-avatar circle. Kept 48
          so the chrome doesn't regress. */}
      <div style={{ gridArea: "topwall", position: "relative", zIndex: 1, height: 48 }}>
        <WoodWall side="top">
          <TopBar />
        </WoodWall>
      </div>

      {/* MENU BAR — Photopea-style, between topwall and canvas */}
      <div style={{ gridArea: "menubar", position: "relative", zIndex: 2 }}>
        <MenuBar />
      </div>

      {/* LEFT WALL — small porthole below toolbar. Day 64d shrank
          from 140 (clipped horizontally inside the 64px rail) to
          48 with ringPadding 8 — fits cleanly with 4px gaps each
          side, reads as a subtle wall detail. */}
      <div style={{ gridArea: "leftwall", position: "relative", zIndex: 1 }}>
        <WoodWall side="left" porthole={{ diameter: 48, position: "lower", ringPadding: 8 }}>
          <ToolPalette />
        </WoodWall>
      </div>

      {/* CANVAS GRID CELL — Pixi mount untouched */}
      <main
        id="tf-canvas"
        tabIndex={-1}
        aria-label="Editor canvas"
        style={{ ...canvasSurface, cursor, gridArea: "canvas" }}
        data-alive="canvas"
      >
        <CompositorHost />
        <TextEditor />
        <BgRemoveOverlay />
        <ZoomIndicator />
      </main>

      {/* RIGHT WALL — locked at 64px. Wood + small porthole; the
          Layers tab brass plaque lives outside the grid as a
          fixed-position sibling. Day 64d shrank porthole from 140
          (which dominated the narrow rail and clipped horizontally)
          to a 48px subtle detail. */}
      <div style={{ gridArea: "rightwall", position: "relative", zIndex: 1 }}>
        <WoodWall side="right" porthole={{ diameter: 48, position: "center", ringPadding: 8 }} />
      </div>

      {/* BOTTOM WALL — 38px high. Status (left) + zoom (right). */}
      <div style={{ gridArea: "bottomwall", position: "relative", zIndex: 1, height: 38 }}>
        <WoodWall side="bottom">
          <BottomBar />
        </WoodWall>
      </div>

      {/* Day 64c — PreviewRack + ThumbFriendPanel float over the
          right edge instead of slotting inside the right wall. They
          slide in over the canvas + right wall when their hotkey
          opens them. The right wall stays a fixed 64px sleeve. */}
      {previewOpen && (
        <div style={floatingRightPanel(280)}>
          <PreviewRack />
        </div>
      )}
      {thumbfriendOpen && (
        <Suspense fallback={null}>
          <div style={floatingRightPanel(360)}>
            <ThumbFriendPanel />
          </div>
        </Suspense>
      )}

      {/* Layers scroll-tab — fixed-position sibling of grid */}
      <LayersScrollTab />

      {/* Day 65b — floating ThumbFriend bubble bottom-right.
          Hidden when the ThumbFriend panel is open. */}
      <ThumbFriendBubble />
    </div>
  );
}

type CursorShape = {
  activeTool: "select" | "hand" | "rect" | "ellipse" | "text";
  isHandMode: boolean;
  isPanActive: boolean;
  hoveredLayerId: string | null;
};

function deriveCursor(s: CursorShape): string {
  if (s.isHandMode || s.activeTool === "hand") {
    return s.isPanActive ? "grabbing" : "grab";
  }
  if (s.activeTool === "rect" || s.activeTool === "ellipse") return "crosshair";
  if (s.activeTool === "text") return "text";
  if (s.activeTool === "select" && s.hoveredLayerId) return "move";
  return "default";
}

// ── styles ──────────────────────────────────────────────────────

const editorGrid: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "grid",
  // Day 64c — 5-cell template with menubar row inserted between
  // topwall and the canvas row. PastDueBanner stacks above the
  // grid template via its own auto row.
  gridTemplateAreas: `
    "topwall    topwall    topwall"
    "menubar    menubar    menubar"
    "leftwall   canvas     rightwall"
    "bottomwall bottomwall bottomwall"
  `,
  gridTemplateRows: "48px 32px 1fr 38px",
  // Right wall locked at 64px — Properties panel removed. PreviewRack
  // / ThumbFriendPanel open as floating overlays, not inside the grid.
  gridTemplateColumns: "64px 1fr 64px",
};

const canvasSurface: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
  // Day 61-fix parchment surround kept — atmosphere shows around
  // the Pixi canvas via radial gradient. Pixi's opaque canvas
  // covers the center.
  background:
    "radial-gradient(ellipse 70% 70% at 50% 50%, " +
    "transparent 70%, " +
    "rgba(240, 224, 192, 0.10) 82%, " +
    "rgba(240, 224, 192, 0.18) 90%, " +
    "rgba(240, 224, 192, 0.08) 100%)",
  boxShadow:
    "inset 0 0 0 1px rgba(245, 230, 200, 0.10), " +
    "inset 0 4px 12px -6px rgba(245, 230, 200, 0.10), " +
    "0 8px 24px -4px rgba(0, 0, 0, 0.55)",
  overflow: "hidden",
  position: "relative",
};

/** Day 64c — overlay container for PreviewRack / ThumbFriendPanel.
 *  Anchored top-right under the menubar (48 topwall + 32 menubar =
 *  80). Bottom matches the bottomwall (38). z-index sits below
 *  --z-floating-panels (= 20) so menubar dropdowns can render on
 *  top when both are open. */
function floatingRightPanel(width: number): CSSProperties {
  return {
    position: "fixed",
    top: 80,
    right: 0,
    bottom: 38,
    width,
    zIndex: 15,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 24px -4px rgba(0, 0, 0, 0.45)",
  };
}
