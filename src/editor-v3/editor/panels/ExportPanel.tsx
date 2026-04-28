import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import {
  exportCanvas,
  downloadBlob,
  formatBytes,
  makeFilename,
  type ExportFormat,
} from "@/lib/export";
import { toast } from "@/toasts/toastStore";
import * as s from "./ExportPanel.styles";

/** Day 18 — "Ship it" export modal. Pick format, tweak quality,
 * preview the result, ship. Watermark always-on for the free tier
 * (Pro flips it off in Cycle 4). Triggered by Cmd+E or the TopBar. */

const PREVIEW_DEBOUNCE_MS = 200;
const YOUTUBE_TARGET_BYTES = 2 * 1024 * 1024;

type Preview = {
  url: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
};

export function ExportPanel() {
  const open = useUiStore((s) => s.exportPanelOpen);
  const close = useUiStore((s) => s.setExportPanelOpen);
  const [format, setFormat] = useState<ExportFormat>("youtube");
  const [quality, setQuality] = useState(90);
  const [filename, setFilename] = useState(() => makeFilename("youtube"));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shipping, setShipping] = useState(false);
  const previewTimer = useRef<number | null>(null);

  // Format change → reset filename's extension.
  useEffect(() => setFilename(makeFilename(format)), [format]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Debounced preview refresh on format / quality changes.
  useEffect(() => {
    if (!open) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      void refreshPreview(format, quality, setPreview);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
  }, [open, format, quality]);

  // Revoke object URL when preview swaps or panel closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!open) return null;
  const isPro = format === "4k";

  async function ship() {
    if (isPro) {
      toast("4K export unlocks at v3.1");
      return;
    }
    setShipping(true);
    try {
      const compositor = getCurrentCompositor();
      if (!compositor) throw new Error("Editor not ready");
      const result = await exportCanvas(compositor, {
        format, jpegQuality: quality, watermark: true,
      });
      downloadBlob(result.blob, filename || result.filename);
      toast(`Shipped ${filename || result.filename}`);
      close(false);
    } catch {
      toast("Couldn't ship — try again?");
    } finally {
      setShipping(false);
    }
  }

  const overTarget =
    format === "youtube" && preview && preview.bytes > YOUTUBE_TARGET_BYTES;

  return (
    <div role="dialog" aria-label="Export thumbnail" style={s.backdrop} onClick={() => close(false)} data-testid="export-panel">
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <header style={s.cardHeader}>Ship it</header>

        <div style={s.section}>
          <div style={s.sectionLabel}>Format</div>
          <div style={s.formatRow}>
            <FormatBtn id="youtube" current={format} onPick={setFormat} label="YouTube" sub="1280×720 JPEG" />
            <FormatBtn id="png" current={format} onPick={setFormat} label="PNG" sub="lossless" />
            <FormatBtn id="jpeg" current={format} onPick={setFormat} label="JPEG" sub="custom q" />
            <FormatBtn id="4k" current={format} onPick={setFormat} label="4K" sub="Pro v3.1" pro />
          </div>
        </div>

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
            <div style={s.previewMeta}>
              {preview.width}×{preview.height} · {formatBytes(preview.bytes)}
              {overTarget && (
                <span style={s.warn}> · over 2 MB — YouTube may downscale</span>
              )}
            </div>
          )}
        </div>

        <div style={s.section}>
          <div style={s.sectionLabel}>Filename</div>
          <input
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
            {shipping ? "Shipping…" : isPro ? "Coming v3.1" : "Ship it"}
          </button>
        </footer>
      </div>
    </div>
  );
}

async function refreshPreview(
  format: ExportFormat,
  quality: number,
  setPreview: (p: Preview | null) => void,
) {
  if (format === "4k") {
    setPreview(null);
    return;
  }
  const compositor = getCurrentCompositor();
  if (!compositor) return;
  try {
    const result = await exportCanvas(compositor, {
      format, jpegQuality: quality, watermark: true,
    });
    const url = URL.createObjectURL(result.blob);
    setPreview({
      url,
      width: result.width,
      height: result.height,
      bytes: result.blob.size,
      mimeType: result.mimeType,
    });
  } catch {
    setPreview(null);
  }
}

function FormatBtn(props: {
  id: ExportFormat;
  current: ExportFormat;
  onPick: (f: ExportFormat) => void;
  label: string;
  sub: string;
  pro?: boolean;
}) {
  const active = props.id === props.current;
  return (
    <button
      type="button"
      onClick={() => props.onPick(props.id)}
      style={{
        ...s.formatBtn,
        ...(active ? s.formatBtnActive : null),
        ...(props.pro ? s.formatBtnPro : null),
      }}
      data-testid={`export-format-${props.id}`}
    >
      <div style={s.formatBtnLabel}>{props.label}</div>
      <div style={s.formatBtnSub}>{props.sub}</div>
    </button>
  );
}
