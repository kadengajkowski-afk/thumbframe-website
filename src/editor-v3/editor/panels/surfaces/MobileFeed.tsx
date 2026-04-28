import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 22 — mobile feed preview surface (iPhone 15 YouTube app card).
 *
 * Mimics the YouTube mobile feed card chrome: avatar + channel
 * header, 16:9 thumbnail, 2-line title, view count + age metadata,
 * action row (like / dislike / share / save).
 *
 * Faithful at-scale rendering: card width matches the rack interior
 * (~236px after card padding); thumbnail width fills that, height
 * stays proportional to the spec's 357×201 (16:9-ish). Native text
 * sizes (16 / 14 / 13 / 12px) — scaling them down would defeat the
 * legibility purpose of the rack. */

const REFRESH_DEBOUNCE_MS = 32;

// Real YouTube mobile palette (dark + light variants).
const DARK = {
  bg: "#0F0F0F", text: "#FFFFFF",
  text2: "#AAAAAA", text3: "#717171",
  border: "#272727",
};
const LIGHT = {
  bg: "#FFFFFF", text: "#0F0F0F",
  text2: "#606060", text3: "#909090",
  border: "#E5E5E5",
};

export function MobileFeedSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const palette = mode === "dark" ? DARK : LIGHT;

  // Aspect-locked thumb width fills the card; height computed from
  // the surface's spec ratio (357:201 ≈ 16:9.05).
  const thumbW = 236;
  const thumbH = Math.round((thumbW * surface.chrome.thumbH) / surface.chrome.thumbW);

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

  // Paint once on mount.
  useEffect(() => { paintThumbnail(canvasRef.current, thumbW, thumbH); }, [thumbW, thumbH]);

  return (
    <div
      style={{ ...wrap, background: palette.bg, color: palette.text }}
      data-testid="surface-mobile-feed-live"
    >
      <header style={headerRow}>
        <div style={{ ...avatar, background: palette.border }} aria-hidden="true">
          <span style={avatarFallback}>C</span>
        </div>
        <div style={channelCol}>
          <div style={{ ...channelLine, color: palette.text }}>
            Channel Name
            <span style={{ ...verified, color: palette.text2 }} title="Verified" aria-label="verified">✓</span>
          </div>
          <div style={{ ...timestamp, color: palette.text3 }}>3 days ago</div>
        </div>
        <span style={{ ...moreBtn, color: palette.text2 }} aria-hidden="true">⋮</span>
      </header>
      <canvas
        ref={canvasRef}
        width={thumbW}
        height={thumbH}
        style={{ ...thumbnail, aspectRatio: `${thumbW} / ${thumbH}` }}
        aria-label="Thumbnail preview"
      />
      <div style={titleStyle}>
        Your video title — does this read clearly inside a real feed card
      </div>
      <div style={{ ...meta, color: palette.text2 }}>
        1.2M views • 3 days ago
      </div>
      <div style={{ ...actions, borderTop: `1px solid ${palette.border}` }}>
        <ActionIcon label="Like" color={palette.text2} icon="👍" />
        <ActionIcon label="Dislike" color={palette.text2} icon="👎" />
        <ActionIcon label="Share" color={palette.text2} icon="↗" />
        <ActionIcon label="Save" color={palette.text2} icon="☰" />
      </div>
    </div>
  );
}

function ActionIcon({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <span style={{ ...actionItem, color }} aria-label={label}>
      <span style={actionGlyph} aria-hidden="true">{icon}</span>
      {label}
    </span>
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
  display: "flex", flexDirection: "column", gap: 6, padding: 8,
  borderRadius: 6,
  // overflow: hidden + min-width: 0 keeps the canvas + text from
  // bleeding past the card when the rack-fit width undercuts the
  // canvas's intrinsic bitmap size. Same fix applied to every
  // surface today (Day 22 bug from Mobile feed).
  overflow: "hidden", minWidth: 0,
  fontFamily: 'Roboto, -apple-system, "Segoe UI", system-ui, sans-serif',
};
const headerRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
};
const avatar: CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const avatarFallback: CSSProperties = {
  fontSize: 14, fontWeight: 600, color: "#FFFFFF",
};
const channelCol: CSSProperties = {
  flex: 1, minWidth: 0,
  display: "flex", flexDirection: "column",
};
const channelLine: CSSProperties = {
  fontSize: 14, fontWeight: 500, lineHeight: 1.2,
  display: "flex", alignItems: "center", gap: 4,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const verified: CSSProperties = { fontSize: 11 };
const timestamp: CSSProperties = {
  fontSize: 12, lineHeight: 1.2, marginTop: 2,
};
const moreBtn: CSSProperties = {
  fontSize: 18, lineHeight: 1, padding: "0 4px",
};
const thumbnail: CSSProperties = {
  display: "block", borderRadius: 4, background: "#000",
  marginTop: 4,
  width: "100%", height: "auto", maxWidth: "100%",
};
const titleStyle: CSSProperties = {
  fontSize: 16, fontWeight: 500, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
  marginTop: 8,
};
const meta: CSSProperties = {
  fontSize: 13, lineHeight: 1.3, marginTop: 2,
};
const actions: CSSProperties = {
  display: "flex", justifyContent: "space-around",
  paddingTop: 8, marginTop: 6,
};
const actionItem: CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 11,
};
const actionGlyph: CSSProperties = { fontSize: 13, lineHeight: 1 };
