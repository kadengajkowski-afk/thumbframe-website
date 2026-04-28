import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 23 — desktop search results card.
 *
 * Real YouTube search at narrow viewports (mobile or shrunken
 * desktop) stacks vertically — thumb on top, info below. At our
 * 280-rack width, horizontal flex (thumb left, info right) crammed
 * the title into ~80px and ate words mid-letter. Vertical reads
 * cleanly and matches what users actually see when they search on
 * a phone.
 *
 * Differentiator from DesktopHomeGrid: this surface includes a
 * description preview (2 lines below the metadata block), which
 * home grid doesn't. Same vertical shape; the description block
 * tells the user "this is search context". */

const REFRESH_DEBOUNCE_MS = 32;
const DARK = { bg: "#0F0F0F", text: "#FFFFFF", text2: "#AAAAAA", text3: "#717171" };
const LIGHT = { bg: "#FFFFFF", text: "#0F0F0F", text2: "#606060", text3: "#909090" };

export function DesktopSearchResultsSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const palette = mode === "dark" ? DARK : LIGHT;
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
      data-testid="surface-desktop-search-live"
    >
      <div style={{ ...thumbWrap, aspectRatio: `${thumbW} / ${thumbH}` }}>
        <canvas
          ref={canvasRef}
          width={thumbW}
          height={thumbH}
          style={thumbnail}
          aria-label="Thumbnail preview"
        />
      </div>
      <div style={textCol}>
        <div style={{ ...title, color: palette.text }}>
          Your video title — search results context
        </div>
        <div style={channelRow}>
          <div style={{ ...miniAvatar, background: palette.text3 }} aria-hidden="true">
            <span style={miniAvatarLabel}>C</span>
          </div>
          <span style={{ ...channelName, color: palette.text2 }}>Channel Name</span>
        </div>
        <div style={{ ...meta, color: palette.text3 }}>
          1.2M views • 3 days ago
        </div>
        <div style={{ ...desc, color: palette.text2 }}>
          A short description preview will read here in the actual feed —
          search results show two lines of body copy that home grid skips.
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
  display: "flex", flexDirection: "column", gap: 8, padding: 8,
  borderRadius: 6,
  overflow: "hidden", minWidth: 0,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const thumbWrap: CSSProperties = {
  position: "relative",
  width: "100%", maxWidth: "100%",
  borderRadius: 8, overflow: "hidden",
  background: "#000",
};
const thumbnail: CSSProperties = {
  display: "block", width: "100%", height: "100%",
};
const textCol: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  minWidth: 0,
};
const title: CSSProperties = {
  fontSize: 16, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
const channelRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  marginTop: 4,
};
const miniAvatar: CSSProperties = {
  width: 20, height: 20, borderRadius: "50%",
  flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const miniAvatarLabel: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#FFFFFF",
};
const channelName: CSSProperties = { fontSize: 12 };
const meta: CSSProperties = { fontSize: 12, lineHeight: 1.3 };
const desc: CSSProperties = {
  fontSize: 12, lineHeight: 1.4,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
  marginTop: 2,
};
