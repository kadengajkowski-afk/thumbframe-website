import { useEffect, useRef, type CSSProperties } from "react";
import { previewBus } from "@/editor/previewBus";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 25 — TV Leanback (YouTube on TV).
 *
 * Always dark — TV apps don't ship a light theme. Heavy padding,
 * huge title text. The big-canvas / big-room context where
 * thumbnails almost always look fine: resolution + size forgive
 * imperfect text spacing or thin strokes that would die on a
 * 168×94 sidebar. Useful as the "best case" baseline. */

export function TVLeanbackSurface({ surface }: { surface: SurfaceSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbW = surface.chrome.thumbW;
  const thumbH = surface.chrome.thumbH;

  useEffect(() => {
    return previewBus.subscribe((source) => {
      paintFromSource(canvasRef.current, source, thumbW, thumbH);
    });
  }, [thumbW, thumbH]);

  return (
    <div style={wrap} data-testid="surface-tv-leanback-live">
      <div style={{ ...thumbWrap, aspectRatio: `${thumbW} / ${thumbH}` }}>
        <canvas
          ref={canvasRef}
          width={thumbW}
          height={thumbH}
          style={thumbnail}
          aria-label="TV Leanback thumbnail preview"
        />
      </div>
      <div style={title}>
        Your video title — at TV scale, the text breathes
      </div>
      <div style={metaRow}>
        <span style={channel}>Channel Name</span>
        <span style={metaSep}>•</span>
        <span style={meta}>1.2M views</span>
        <span style={metaSep}>•</span>
        <span style={meta}>3 days ago</span>
      </div>
    </div>
  );
}

function paintFromSource(target: HTMLCanvasElement | null, source: HTMLCanvasElement, w: number, h: number): void {
  if (!target) return;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
}

// TV is always dark — no light variant. Heavy padding + huge text
// to mimic the 10-foot UI scale.
const wrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10, padding: 16,
  background: "#0F0F0F", color: "#FFFFFF",
  borderRadius: 8,
  overflow: "hidden", minWidth: 0,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const thumbWrap: CSSProperties = {
  position: "relative",
  width: "100%", maxWidth: "100%",
  borderRadius: 6, overflow: "hidden",
  background: "#000",
};
const thumbnail: CSSProperties = {
  display: "block", width: "100%", height: "100%",
};
const title: CSSProperties = {
  // Spec called for 28px; rack-fit nudges it down so 2-line titles
  // don't dominate the surface. Still much bigger than other
  // surfaces — the TV-feel is preserved.
  fontSize: 18, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
  marginTop: 4,
};
const metaRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  flexWrap: "wrap",
  fontSize: 13, color: "#AAAAAA",
};
const channel: CSSProperties = { color: "#FFFFFF" };
const meta: CSSProperties = {};
const metaSep: CSSProperties = { color: "#717171" };
