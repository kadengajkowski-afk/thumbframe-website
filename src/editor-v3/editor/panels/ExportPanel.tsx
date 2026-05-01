import { useEffect, useRef, useState } from "react";
import { useUiStore, type RecentExport } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import {
  exportCanvas,
  makeFilename,
  type ExportBackground,
  type ExportFormat,
} from "@/lib/export";
import { shipExport } from "@/lib/exportFlow";
import * as s from "./ExportPanel.styles";
import {
  BackgroundSection,
  BG_PRESETS,
  FormatSection,
  PreviewMeta,
  RecentSection,
} from "./ExportPanel.sections";

/** Day 18 + 19 — "Ship it" export modal. Pick format + bg + quality,
 * preview the result, ship. Watermark + 4K gate driven by uiStore.userTier
 * (free → watermark on, 4K throws; pro → watermark off, 4K unlocked). */

const PREVIEW_DEBOUNCE_MS = 200;
const YOUTUBE_TARGET_BYTES = 2 * 1024 * 1024;

type Preview = {
  url: string;
  width: number;
  height: number;
  bytes: number;
};

function bgFromId(id: string): ExportBackground {
  const preset = BG_PRESETS.find((p) => p.id === id);
  if (!preset || preset.transparent) return { kind: "transparent" };
  return { kind: "color", color: preset.color ?? 0x000000 };
}

export function ExportPanel() {
  const open = useUiStore((s) => s.exportPanelOpen);
  const close = useUiStore((s) => s.setExportPanelOpen);
  const userTier = useUiStore((s) => s.userTier);
  const recents = useUiStore((s) => s.recentExports);
  const isPro = userTier === "pro";

  const [format, setFormat] = useState<ExportFormat>("youtube");
  const [quality, setQuality] = useState(90);
  const [bgId, setBgId] = useState("dark");
  const [filename, setFilename] = useState(() => makeFilename("youtube"));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shipping, setShipping] = useState(false);
  const previewTimer = useRef<number | null>(null);
  const filenameRef = useRef<HTMLInputElement>(null);

  // When format changes, swap the FILENAME EXTENSION but preserve
  // the user's typed basename. The previous behavior wiped the
  // typed name with `makeFilename(format)` — destructive.
  // Day 49 — keep basename, just retarget extension to match format.
  useEffect(() => {
    setFilename((cur) => {
      const targetExt = format === "png" || format === "4k" ? "png" : "jpg";
      const m = cur.match(/^(.*?)(?:\.(?:png|jpg|jpeg|webp))?$/i);
      const base = m?.[1] || cur || makeFilename(format).replace(/\.[a-z]+$/, "");
      const next = `${base}.${targetExt}`;
      return next === cur ? cur : next;
    });
  }, [format]);

  // Day 49 — when the user TYPES a filename ending in a known image
  // extension that doesn't match the active format, swap the format
  // to match. Catches "type 'foo.png' while format=jpeg → JPEG named
  // foo.png" foot-gun. The format-change effect above is now extension-
  // aware, so it won't loop / overwrite the user's basename.
  useEffect(() => {
    const m = filename.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/);
    if (!m) return;
    const ext = m[1] === "jpg" ? "jpeg" : m[1];
    if (ext === "png" && format === "jpeg") setFormat("png");
    else if (ext === "jpeg" && format === "png") setFormat("jpeg");
    // webp — not a v3 format yet (deferred); leave alone.
  }, [filename, format]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-focus filename on first open so the user can rename immediately.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => filenameRef.current?.focus());
  }, [open]);

  // Debounced preview refresh.
  useEffect(() => {
    if (!open) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      void refreshPreview(format, quality, bgId, isPro, setPreview);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
  }, [open, format, quality, bgId, isPro]);

  // Revoke object URL when preview swaps.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  if (!open) return null;

  async function ship() {
    setShipping(true);
    const result = await shipExport({
      format, jpegQuality: quality,
      background: bgFromId(bgId),
      filename,
    });
    setShipping(false);
    if (result) close(false);
  }

  function applyRecent(r: RecentExport) {
    setFormat(r.format);
    setQuality(r.quality);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !shipping) {
      e.preventDefault();
      void ship();
    }
  }

  const overTarget =
    format === "youtube" && preview ? preview.bytes > YOUTUBE_TARGET_BYTES : false;

  return (
    <div role="dialog" aria-label="Export thumbnail" style={s.backdrop} onClick={() => close(false)} data-testid="export-panel">
      <div style={s.card} onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <header style={s.cardHeader}>Ship it</header>

        <FormatSection format={format} onPick={setFormat} isPro={isPro} />

        {format === "jpeg" && (
          <div style={s.section}>
            <div style={s.sectionLabel}>
              Quality <span style={s.qualityNum}>{quality}</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              style={s.slider}
              data-testid="export-quality"
            />
          </div>
        )}

        <BackgroundSection bgId={bgId} onPick={setBgId} format={format} />

        <RecentSection recents={recents} onPick={applyRecent} />

        <div style={s.section}>
          <div style={s.sectionLabel}>Preview</div>
          <div style={s.previewBox}>
            {preview ? (
              <img src={preview.url} alt="export preview" style={s.previewImg} />
            ) : (
              <div style={s.previewEmpty}>Rendering…</div>
            )}
          </div>
          {preview && (
            <PreviewMeta width={preview.width} height={preview.height} bytes={preview.bytes} overTarget={overTarget} />
          )}
        </div>

        <div style={s.section}>
          <div style={s.sectionLabel}>Filename</div>
          <input
            ref={filenameRef}
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={s.input}
            data-testid="export-filename"
          />
        </div>

        <footer style={s.footer}>
          <button type="button" style={s.cancelBtn} onClick={() => close(false)}>
            Cancel
          </button>
          <button
            type="button"
            style={s.shipBtn}
            onClick={ship}
            disabled={shipping}
            data-testid="export-ship"
          >
            {shipping ? "Shipping…" : "Ship it"}
          </button>
        </footer>
      </div>
    </div>
  );
}

async function refreshPreview(
  format: ExportFormat,
  quality: number,
  bgId: string,
  isPro: boolean,
  setPreview: (p: Preview | null) => void,
) {
  if (format === "4k" && !isPro) {
    setPreview(null);
    return;
  }
  const compositor = getCurrentCompositor();
  if (!compositor) return;
  try {
    const result = await exportCanvas(compositor, {
      format,
      jpegQuality: quality,
      watermark: !isPro,
      background: bgFromId(bgId),
      isPro,
    });
    const url = URL.createObjectURL(result.blob);
    setPreview({
      url,
      width: result.width,
      height: result.height,
      bytes: result.blob.size,
    });
  } catch {
    setPreview(null);
  }
}
