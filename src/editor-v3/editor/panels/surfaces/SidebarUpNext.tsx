import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 21 — sidebar Up Next preview surface. The legibility stress
 * test: 168×94 thumbnail next to a 2-line title @ 14px Roboto Medium,
 * with channel name + "1.2M views • 3 days ago" metadata.
 *
 * Implementation: subscribes to docStore.layers + previewMode +
 * masterTexture refresh; on change, refreshMasterTexture() then
 * extract.canvas() the master into an HTMLCanvasElement and
 * drawImage onto a 168×94 <canvas> in the JSX. One renderer call
 * per layer change is fine at v3 layer counts. Throttled by the
 * masterTextureMgr's 16ms debounce upstream. */

const THUMB_W = 168;
const THUMB_H = 94;
const REFRESH_DEBOUNCE_MS = 32;

export function SidebarUpNextSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      paintThumbnail(canvasRef.current);
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
    // We intentionally re-run on layers reference change so any layer
    // mutation (move, color change, etc.) triggers a thumbnail refresh.
  }, [layers]);

  // Paint once on mount so the surface isn't blank before the first edit.
  useEffect(() => { paintThumbnail(canvasRef.current); }, []);

  const isDark = mode === "dark";
  return (
    <div
      style={{
        ...wrap,
        background: isDark ? "#0F0F0F" : "#FFFFFF",
        color: isDark ? "#FFFFFF" : "#0F0F0F",
      }}
      data-testid="surface-sidebar-up-next-live"
    >
      <canvas
        ref={canvasRef}
        width={THUMB_W}
        height={THUMB_H}
        style={thumbnail}
        aria-label="Thumbnail preview"
      />
      <div style={textCol}>
        <div
          style={{
            ...titleStyle,
            color: isDark ? "#FFFFFF" : "#0F0F0F",
            // Reserve N lines of height per the surface spec.
            // line-clamp keeps overflow truncated.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — webkit clamp prop
            WebkitLineClamp: surface.titleLines,
          }}
        >
          Your video title — does it survive at 168 wide
        </div>
        <div style={{ ...channel, color: isDark ? "#AAA" : "#606060" }}>
          Channel Name
        </div>
        <div style={{ ...meta, color: isDark ? "#AAA" : "#606060" }}>
          1.2M views • 3 days ago
        </div>
      </div>
    </div>
  );
}

function paintThumbnail(target: HTMLCanvasElement | null): void {
  if (!target) return;
  const compositor = getCurrentCompositor();
  if (!compositor) return;
  const masterTex = compositor.masterTexture;
  if (!masterTex) return;
  // Force one master refresh so the texture reflects the latest layers
  // (the layer subscription scheduled a debounced refresh; this snaps
  // it immediate so the readback below sees fresh pixels).
  compositor.refreshMasterTexture();
  let source: HTMLCanvasElement;
  try {
    source = compositor.app.renderer.extract.canvas({
      target: masterTex,
    }) as HTMLCanvasElement;
  } catch {
    return;
  }
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);
  ctx.drawImage(source, 0, 0, THUMB_W, THUMB_H);
}

// Stack thumb on top + text below so the card fits the 280-wide
// rack without clipping. Real YouTube sidebar cards do horizontal
// (thumb left, text right) but at 280px container width that leaves
// ~44px for the title — unreadable. Vertical mimics the same chrome
// pieces in a fittable shape.
const wrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, padding: 8,
  borderRadius: 6,
  fontFamily: "Roboto, system-ui, sans-serif",
};
const thumbnail: CSSProperties = {
  width: THUMB_W, height: THUMB_H,
  borderRadius: 4, background: "#000",
  display: "block",
};
const textCol: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2, minWidth: 0,
};
const titleStyle: CSSProperties = {
  fontSize: 14, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  overflow: "hidden", textOverflow: "ellipsis",
};
const channel: CSSProperties = {
  fontSize: 12, marginTop: 4,
};
const meta: CSSProperties = { fontSize: 11 };
