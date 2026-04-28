import { useEffect, useRef, type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { SurfaceSpec } from "@/editor/previewSurfaces";

/** Day 25 — Lockscreen push notification surface.
 *
 * Two stacked variants:
 *   - iOS: 88×88 center-cropped square thumb (the iOS notification
 *     standard); app icon + title text right.
 *   - Android: 256×144 16:9 thumb; app icon + title + channel.
 *
 * Both render against a soft-dim background to simulate the
 * blurred lockscreen wallpaper. previewMode flips between system
 * dark / light tints. */

const REFRESH_DEBOUNCE_MS = 32;
const CANVAS_W = 1280;
const CANVAS_H = 720;
// iOS center-crop: take the 720×720 square out of the 16:9 canvas.
const IOS_CROP_X = (CANVAS_W - CANVAS_H) / 2;

export function LockscreenPushSurface({ surface }: { surface: SurfaceSpec }) {
  const layers = useDocStore((s) => s.layers);
  const mode = useUiStore((s) => s.previewMode);
  const iosCanvasRef = useRef<HTMLCanvasElement>(null);
  const androidCanvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | null>(null);
  void surface;
  const isDark = mode === "dark";

  useEffect(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      paintIosThumb(iosCanvasRef.current);
      paintAndroidThumb(androidCanvasRef.current);
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [layers]);

  useEffect(() => {
    paintIosThumb(iosCanvasRef.current);
    paintAndroidThumb(androidCanvasRef.current);
  }, []);

  const wallpaper = isDark
    ? "linear-gradient(135deg, #0F0F0F 0%, #1F1F2F 100%)"
    : "linear-gradient(135deg, #C8D6E5 0%, #DDE7F0 100%)";

  return (
    <div style={{ ...wrap, background: wallpaper }} data-testid="surface-lockscreen-live">
      {/* iOS push */}
      <div style={{ ...card, ...(isDark ? cardDark : cardLight) }} data-testid="lockscreen-ios">
        <div style={iosThumbWrap}>
          <canvas
            ref={iosCanvasRef}
            width={CANVAS_H}
            height={CANVAS_H}
            style={canvasFill}
            aria-label="iOS lockscreen thumbnail"
          />
        </div>
        <div style={iosTextCol}>
          <div style={iosHeader}>
            <span style={appIcon} aria-hidden="true">▶</span>
            <span style={iosAppName}>YOUTUBE</span>
            <span style={iosTimestamp}>now</span>
          </div>
          <div style={{ ...iosTitle, color: isDark ? "#FFFFFF" : "#000000" }}>
            Channel Name uploaded a video
          </div>
          <div style={{ ...iosBody, color: isDark ? "#AAAAAA" : "#3C3C43" }}>
            Your video title — does this push read clearly?
          </div>
        </div>
      </div>

      {/* Android push */}
      <div style={{ ...card, ...(isDark ? cardDark : cardLight) }} data-testid="lockscreen-android">
        <div style={androidHeader}>
          <span style={appIcon} aria-hidden="true">▶</span>
          <span style={androidAppName}>YouTube</span>
          <span style={androidTimestamp}>• now</span>
        </div>
        <div style={{ ...androidTitle, color: isDark ? "#FFFFFF" : "#000000" }}>
          Channel Name uploaded
        </div>
        <div style={{ ...androidBody, color: isDark ? "#AAAAAA" : "#5F6368" }}>
          Your video title — push notification preview
        </div>
        <div style={{ ...androidThumbWrap, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
          <canvas
            ref={androidCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={canvasFill}
            aria-label="Android lockscreen thumbnail"
          />
        </div>
      </div>
    </div>
  );
}

function paintIosThumb(target: HTMLCanvasElement | null): void {
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
  ctx.clearRect(0, 0, target.width, target.height);
  // Center-crop the 16:9 master into the iOS square thumb.
  ctx.drawImage(source, IOS_CROP_X, 0, CANVAS_H, CANVAS_H, 0, 0, target.width, target.height);
}

function paintAndroidThumb(target: HTMLCanvasElement | null): void {
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
  ctx.clearRect(0, 0, target.width, target.height);
  // Android keeps the full 16:9 frame.
  ctx.drawImage(source, 0, 0, target.width, target.height);
}

const wrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8, padding: 12,
  borderRadius: 10, overflow: "hidden", minWidth: 0,
  fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif',
};
const card: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  padding: 10, borderRadius: 12,
  backdropFilter: "blur(20px)",
};
const cardDark: CSSProperties = {
  background: "rgba(40,40,40,0.85)", color: "#FFFFFF",
  border: "1px solid rgba(255,255,255,0.08)",
};
const cardLight: CSSProperties = {
  background: "rgba(255,255,255,0.85)", color: "#000000",
  border: "1px solid rgba(0,0,0,0.08)",
};
const iosThumbWrap: CSSProperties = {
  position: "absolute", right: 10, top: 10,
  width: 56, height: 56,
  borderRadius: 6, overflow: "hidden",
  background: "#000",
};
const iosTextCol: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2,
  paddingRight: 70, minHeight: 56,
};
const iosHeader: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 11, color: "#8E8E93",
  letterSpacing: "0.06em", textTransform: "uppercase",
};
const iosAppName: CSSProperties = { flex: 1, fontWeight: 500 };
const iosTimestamp: CSSProperties = { fontSize: 10 };
const iosTitle: CSSProperties = {
  fontSize: 13, fontWeight: 600, lineHeight: 1.3,
  marginTop: 2,
};
const iosBody: CSSProperties = {
  fontSize: 12, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
// Unfortunately position: absolute on the iOS thumb wrap requires
// the card to be position: relative. Set it inline above where
// `card` style is spread.
(card as { position?: string }).position = "relative";

const androidHeader: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 11, color: "#5F6368",
};
const androidAppName: CSSProperties = { fontWeight: 500 };
const androidTimestamp: CSSProperties = { fontSize: 10 };
const androidTitle: CSSProperties = {
  fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginTop: 2,
};
const androidBody: CSSProperties = {
  fontSize: 12, lineHeight: 1.3,
  display: "-webkit-box", WebkitBoxOrient: "vertical",
  WebkitLineClamp: 1 as unknown as number,
  overflow: "hidden", textOverflow: "ellipsis",
};
const androidThumbWrap: CSSProperties = {
  position: "relative",
  width: "100%", maxWidth: "100%",
  marginTop: 6,
  borderRadius: 6, overflow: "hidden",
  background: "#000",
};
const appIcon: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 16, height: 16,
  borderRadius: 4,
  background: "#FF0000", color: "#FFFFFF",
  fontSize: 10, fontWeight: 700,
};
const canvasFill: CSSProperties = {
  display: "block", width: "100%", height: "100%",
};
