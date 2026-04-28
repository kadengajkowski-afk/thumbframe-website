import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 23 — desktop YouTube home grid card.
 *
 * Real layout: thumbnail on top with rounded bottom corners
 * (12px), then a row with channel avatar + title block. Title
 * is bigger than the mobile feed (16px → effectively the same in
 * Roboto Medium); meta is one line below. Most-common context for
 * thumbnail evaluation. */

const REFRESH_DEBOUNCE_MS = 32;
const DARK = { bg: "#0F0F0F", text: "#FFFFFF", text2: "#AAAAAA", text3: "#717171" };
const LIGHT = { bg: "#FFFFFF", text: "#0F0F0F", text2: "#606060", text3: "#909090" };

export function DesktopHomeGridSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const palette = mode === "dark" ? DARK : LIGHT;

  // Render at the spec's intrinsic resolution; CSS maxWidth keeps it
  // bounded by the rack-fit container width. aspect-ratio holds 16:9.
  const thumbW = surface.chrome.thumbW;
  const thumbH = surface.chrome.thumbH;

  useEffect(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      paintThumbnail(canvasRef.current, thumbW, thumbH);
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [layers, thumbW, thumbH]);

  useEffect(() => { paintThumbnail(canvasRef.current, thumbW, thumbH); }, [thumbW, thumbH]);

  return (
    <div
      style={{ ...wrap, background: palette.bg, color: palette.text }}
      data-testid="surface-desktop-home-live"
    >
      <canvas
        ref={canvasRef}
        width={thumbW}
        height={thumbH}
        style={{ ...thumbnail, aspectRatio: `${thumbW} / ${thumbH}` }}
        aria-label="Thumbnail preview"
      />
      <div style={infoRow}>
        <div style={{ ...avatar, background: "var(--border-ghost)" }} aria-hidden="true">
          <span style={avatarFallback}>C</span>
        </div>
        <div style={textCol}>
          <div style={{ ...title, color: palette.text }}>
            Your video title — does this read clearly in the home grid
          </div>
          <div style={{ ...channel, color: palette.text2 }}>
            Channel Name
          </div>
          <div style={{ ...meta, color: palette.text3 }}>
            1.2M views • 3 days ago
          </div>
        </div>
      </div>
    </div>
  );
}

function paintThumbnail(target: HTMLCanvasElement | null, w: number, h: number): void {
  if (!target) return;
  const compositor = getCurrentCompositor();
  if (!compositor) return;
  const masterTex = compositor.masterTexture;
  if (!masterTex) return;
  compositor.refreshMasterTexture();
  let source: HTMLCanvasElement;
  try {
    source = compositor.app.renderer.extract.canvas({ target: masterTex }) as HTMLCanvasElement;
  } catch {
    return;
  }
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
}

const wrap: CSSProperties = {
  display: "flex", flexDirection: "column",
  borderRadius: 6,
  // Bug fix from Day 22: clip thumbnail to card bounds.
  overflow: "hidden", minWidth: 0,
  padding: 8,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const thumbnail: CSSProperties = {
  display: "block", background: "#000",
  // Real YouTube home thumbnails have 12px rounded corners.
  borderRadius: "4px 4px 12px 12px",
  width: "100%", height: "auto", maxWidth: "100%",
  marginBottom: 12,
};
const infoRow: CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start",
  paddingTop: 4,
};
const avatar: CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const avatarFallback: CSSProperties = {
  fontSize: 14, fontWeight: 600, color: "#FFFFFF",
};
const textCol: CSSProperties = {
  flex: 1, minWidth: 0,
  display: "flex", flexDirection: "column", gap: 2,
};
const title: CSSProperties = {
  fontSize: 16, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
const channel: CSSProperties = {
  fontSize: 14, marginTop: 6,
};
const meta: CSSProperties = {
  fontSize: 14, lineHeight: 1.3,
};
