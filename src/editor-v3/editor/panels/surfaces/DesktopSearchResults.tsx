import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 23 — desktop search results card.
 *
 * Real layout: thumbnail LEFT, info RIGHT (flex-row). Bigger
 * thumbnail than the home grid (360×202 in spec). At rack-fitting
 * width the thumb shrinks to ~140 wide; info column gets the
 * remainder. Title slightly tighter than spec's 18px (we use 14)
 * because the info column is narrow at 280px rack width. The
 * point is the LAYOUT shape (horizontal vs vertical), not pixel-
 * perfect text size — it's the visual "search result" identity. */

const REFRESH_DEBOUNCE_MS = 32;
const DARK = { bg: "#0F0F0F", text: "#FFFFFF", text2: "#AAAAAA", text3: "#717171" };
const LIGHT = { bg: "#FFFFFF", text: "#0F0F0F", text2: "#606060", text3: "#909090" };

const THUMB_W = 140;
const THUMB_H = Math.round((THUMB_W * 202) / 360); // proportional to spec → 79

export function DesktopSearchResultsSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const palette = mode === "dark" ? DARK : LIGHT;
  // Read surface so the lint doesn't yell — we also pull the spec's
  // ratio implicitly via THUMB_W/THUMB_H constants above.
  void surface;

  useEffect(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      paintThumbnail(canvasRef.current, THUMB_W, THUMB_H);
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [layers]);

  useEffect(() => { paintThumbnail(canvasRef.current, THUMB_W, THUMB_H); }, []);

  return (
    <div
      style={{ ...wrap, background: palette.bg, color: palette.text }}
      data-testid="surface-desktop-search-live"
    >
      <canvas
        ref={canvasRef}
        width={THUMB_W}
        height={THUMB_H}
        style={{ ...thumbnail, aspectRatio: `${THUMB_W} / ${THUMB_H}` }}
        aria-label="Thumbnail preview"
      />
      <div style={textCol}>
        <div style={{ ...title, color: palette.text }}>
          Your video title — search results context
        </div>
        <div style={{ ...meta, color: palette.text3 }}>
          1.2M views • 3 days ago
        </div>
        <div style={channelRow}>
          <div style={{ ...miniAvatar, background: "var(--border-ghost)" }} aria-hidden="true">
            <span style={miniAvatarLabel}>C</span>
          </div>
          <span style={{ ...channelName, color: palette.text2 }}>Channel Name</span>
        </div>
        <div style={{ ...desc, color: palette.text2 }}>
          A short description preview will read here in the actual feed.
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
  display: "flex", flexDirection: "row", gap: 10,
  borderRadius: 6, padding: 8,
  // Bug fix from Day 22: clip overflow.
  overflow: "hidden", minWidth: 0,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const thumbnail: CSSProperties = {
  display: "block", background: "#000",
  borderRadius: 8, flexShrink: 0,
  width: THUMB_W,
};
const textCol: CSSProperties = {
  flex: 1, minWidth: 0,
  display: "flex", flexDirection: "column", gap: 4,
};
const title: CSSProperties = {
  fontSize: 14, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
const meta: CSSProperties = { fontSize: 11, lineHeight: 1.3 };
const channelRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  marginTop: 2,
};
const miniAvatar: CSSProperties = {
  width: 16, height: 16, borderRadius: "50%",
  flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const miniAvatarLabel: CSSProperties = {
  fontSize: 9, fontWeight: 600, color: "#FFFFFF",
};
const channelName: CSSProperties = { fontSize: 11 };
const desc: CSSProperties = {
  fontSize: 11, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
  marginTop: 2,
};
