import { useEffect, useRef, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import { previewBus } from "@/editor/previewBus";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 24 — mobile Shorts shelf. The 4:5 crop trap.
 *
 * YouTube Shorts thumbnails are 4:5 portrait. The user designs at
 * 16:9 (1280×720). The Shorts shelf center-crops the 16:9 to 4:5
 * — designers' content near the LEFT and RIGHT edges gets cut.
 * Surface always shows a warning since we can't yet detect whether
 * content actually lives in the cropped zones (content-aware crop
 * detection is a v3.1 feature). */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const THUMB_W = 180;
const THUMB_H = 225; // 4:5
// Center vertical strip of 16:9 → 4:5: 720 * 4/5 = 576 wide.
const CROP_W = CANVAS_H * (4 / 5); // = 576
const CROP_X = (CANVAS_W - CROP_W) / 2; // = 352

export function MobileShortsShelfSurface({ surface }: { surface: SurfaceSpec }) {
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  void surface;
  const isDark = mode === "dark";

  useEffect(() => {
    return previewBus.subscribe((source) => {
      paintCroppedFromSource(canvasRef.current, source);
    });
  }, []);

  return (
    <div
      style={{
        ...wrap,
        background: isDark ? "#0F0F0F" : "#FFFFFF",
        color: isDark ? "#FFFFFF" : "#0F0F0F",
      }}
      data-testid="surface-mobile-shorts-live"
    >
      <div style={thumbWrap}>
        <canvas
          ref={canvasRef}
          width={CROP_W}
          height={CANVAS_H}
          style={thumbnail}
          aria-label="Shorts thumbnail preview (4:5 crop)"
        />
        <div style={titleOverlay}>
          Your video title — does this read at 4:5?
        </div>
        <div style={viewsOverlay}>
          ▶ 1.2M
        </div>
      </div>
      <div style={{ ...warning, color: isDark ? "#F59E0B" : "#B45309" }} data-testid="shorts-crop-warning">
        ⚠️ Sides cropped — content near edges may be cut
      </div>
    </div>
  );
}

function paintCroppedFromSource(target: HTMLCanvasElement | null, source: HTMLCanvasElement): void {
  if (!target) return;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, target.width, target.height);
  // Crop the center vertical strip of the 16:9 master into the 4:5 target.
  ctx.drawImage(
    source,
    CROP_X, 0, CROP_W, CANVAS_H,
    0, 0, target.width, target.height,
  );
}

const wrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8, padding: 8,
  borderRadius: 6,
  overflow: "hidden", minWidth: 0,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const thumbWrap: CSSProperties = {
  position: "relative", width: THUMB_W, height: THUMB_H,
  maxWidth: "100%",
  borderRadius: 6, overflow: "hidden",
  background: "#000", margin: "0 auto",
};
const thumbnail: CSSProperties = {
  display: "block", width: "100%", height: "100%",
  background: "#000",
  aspectRatio: `${THUMB_W} / ${THUMB_H}`,
};
const titleOverlay: CSSProperties = {
  position: "absolute", left: 8, right: 8, bottom: 8,
  fontSize: 12, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3,
  textShadow: "0 2px 6px rgba(0,0,0,0.85)",
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
const viewsOverlay: CSSProperties = {
  position: "absolute", left: 8, top: 8,
  background: "rgba(0,0,0,0.6)",
  color: "#FFFFFF", fontSize: 10, fontWeight: 500,
  padding: "2px 6px", borderRadius: 4,
};
const warning: CSSProperties = {
  fontSize: 10, lineHeight: 1.3, fontStyle: "italic",
  textAlign: "center",
};
