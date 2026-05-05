import { Suspense, lazy, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { CompositorHost } from "@/editor/CompositorHost";
import { TextEditor } from "@/editor/TextEditor";
import { BgRemoveOverlay } from "@/editor/BgRemoveOverlay";
import { TopBar } from "@/editor/panels/TopBar";
import { LayersScrollTab } from "@/editor/panels/LayersScrollTab";
import { ContextPanel } from "@/editor/panels/ContextPanel";
import { ZoomIndicator } from "@/editor/ZoomIndicator";
import { ToolPalette } from "@/editor/panels/ToolPalette";
import { PreviewRack } from "@/editor/panels/PreviewRack";
import { PastDueBanner } from "@/editor/panels/PastDueBanner";
import { WoodWall } from "@/editor/walls/WoodWall";

const ThumbFriendPanel = lazy(() =>
  import("@/editor/panels/ThumbFriendPanel").then((m) => ({ default: m.ThumbFriendPanel })),
);

/** Day 64a — EditorShell extracted from App.tsx + restructured to
 *  wrap each grid cell in a WoodWall scaffold.
 *
 *  Grid layout (5 named cells):
 *    "topwall    topwall    topwall"     auto
 *    "leftwall   canvas     rightwall"   1fr
 *    "bottomwall bottomwall bottomwall"  auto
 *    / 64px      1fr        auto
 *
 *  - The top + bottom rows are `auto` so they size to their
 *    children. TopBar (currently 48px) determines top row; bottom
 *    is empty for 64a (collapses to 0).
 *  - Left wall is a fixed 64px column (will host the toolbar in
 *    64c).
 *  - Right wall is `auto` so the existing variable-width
 *    ContextPanel (280) / PreviewRack / ThumbFriend (320) keep
 *    their dimensions.
 *  - Canvas grid cell takes the 1fr middle column.
 *
 *  Walls are transparent today; 64b replaces inner-panel wood
 *  with wall-level wood and adds porthole cutouts. */

export function EditorShell() {
  const cursor = useUiStore(deriveCursor);
  const previewOpen = useUiStore((s) => s.previewRackOpen);
  const thumbfriendOpen = useUiStore((s) => s.thumbfriendPanelOpen);

  return (
    <div style={editorGrid}>
      <PastDueBanner />

      {/* TOP WALL — small porthole top-center */}
      <div style={{ gridArea: "topwall", position: "relative", zIndex: 1, height: 48 }}>
        <WoodWall side="top">
          <TopBar />
        </WoodWall>
      </div>

      {/* LEFT WALL — porthole lower third (below toolbar) */}
      <div style={{ gridArea: "leftwall", position: "relative", zIndex: 1 }}>
        <WoodWall side="left" porthole={{ diameter: 140, position: "lower" }}>
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

      {/* RIGHT WALL — porthole center */}
      <div style={{ gridArea: "rightwall", position: "relative", zIndex: 1 }}>
        <WoodWall side="right" porthole={{ diameter: 140, position: "center" }}>
          {thumbfriendOpen ? (
            <Suspense
              fallback={
                <aside
                  style={{
                    width: 320,
                    background: "var(--panel-frost-bg)",
                    backdropFilter: "var(--panel-frost-blur)",
                    borderLeft: "1px solid var(--panel-frost-border)",
                  }}
                />
              }
            >
              <ThumbFriendPanel />
            </Suspense>
          ) : previewOpen ? (
            <PreviewRack />
          ) : (
            <ContextPanel />
          )}
        </WoodWall>
      </div>

      {/* BOTTOM WALL — 38px high, small porthole top-center for 64c
          status + zoom controls to land later. */}
      <div style={{ gridArea: "bottomwall", position: "relative", zIndex: 1, height: 38 }}>
        <WoodWall side="bottom">
          {/* 64c content lands here */}
        </WoodWall>
      </div>

      {/* Layers scroll-tab — fixed-position sibling of grid */}
      <LayersScrollTab />
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
  // Day 64a — 5-cell template. PastDueBanner row above the grid
  // template (its own auto row stacked at the top of the grid).
  // Top row = auto so TopBar's 48px determines it. Middle row = 1fr.
  // Bottom row = auto, collapses to 0 when BottomWall has no
  // content. Left col = 64px (toolbar), middle = 1fr (canvas),
  // right = auto (ContextPanel 280 / PreviewRack / ThumbFriend 320).
  gridTemplateAreas: `
    "topwall    topwall  topwall"
    "leftwall   canvas   rightwall"
    "bottomwall bottomwall bottomwall"
  `,
  gridTemplateRows: "auto 1fr auto",
  // Day 64a — left col matches existing ToolPalette width (56px) so
  // this scaffolding is visually a no-op. Day 64c bumps it to 64px
  // when the toolbar contents move inside the wall.
  gridTemplateColumns: "56px 1fr auto",
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
