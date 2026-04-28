import {
  exportCanvas,
  downloadBlob,
  makeFilename,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from "./export";
import { unionBounds } from "./bounds";
import { getCurrentCompositor } from "@/editor/compositorRef";
import { useDocStore } from "@/state/docStore";
import { useUiStore, type RecentExport } from "@/state/uiStore";
import { toast } from "@/toasts/toastStore";

/** Day 19 — shared "ship" path used by both the ExportPanel's
 * "Ship it" button and Cmd+Shift+E (re-export with last settings).
 * Owns the mutate-store + download-blob + toast cycle so callers
 * just supply the options. */

export type ShipOptions = {
  format: ExportFormat;
  jpegQuality: number;
  background: { kind: "transparent" } | { kind: "color"; color: number };
  /** Optional caller-provided filename — defaults to date-tagged. */
  filename?: string;
  /** Optional canvas-coords sub-region (selection export). */
  region?: { x: number; y: number; width: number; height: number };
};

export async function shipExport(opts: ShipOptions): Promise<ExportResult | null> {
  const compositor = getCurrentCompositor();
  if (!compositor) {
    toast("Editor not ready");
    return null;
  }
  const tier = useUiStore.getState().userTier;
  if (opts.format === "4k" && tier !== "pro") {
    toast("4K export unlocks at v3.1");
    return null;
  }
  const exportOpts: ExportOptions = {
    format: opts.format,
    jpegQuality: opts.jpegQuality,
    watermark: tier === "free",
    background: opts.background,
    isPro: tier === "pro",
    ...(opts.region ? { region: opts.region } : {}),
  };
  let result: ExportResult;
  try {
    result = await exportCanvas(compositor, exportOpts);
  } catch {
    toast("Couldn't ship — try again?");
    return null;
  }
  const filename = opts.filename || result.filename;
  downloadBlob(result.blob, filename);
  toast(`Shipped ${filename}`);
  // Stash to recents + last-export for Cmd+Shift+E.
  const entry: RecentExport = {
    format: opts.format,
    quality: opts.jpegQuality,
    width: result.width,
    height: result.height,
    filename,
    timestamp: Date.now(),
  };
  useUiStore.getState().pushRecentExport(entry);
  useUiStore.getState().setLastExport(entry);
  return result;
}

/** Day 19: re-export with last-used settings. Cmd+Shift+E binds to
 * this. If the user has never shipped, fall back to opening the
 * panel via a sentinel. */
export async function shipWithLastSettings(): Promise<void> {
  const last = useUiStore.getState().lastExport;
  if (!last) {
    useUiStore.getState().setExportPanelOpen(true);
    return;
  }
  await shipExport({
    format: last.format,
    jpegQuality: last.quality,
    background: { kind: "color", color: 0x000000 },
    filename: makeFilename(last.format),
  });
}

/** Day 19: selection-aware export — uses the bounding box of the
 * currently-selected layers as the export region. If nothing's
 * selected, surfaces a toast and bails. */
export async function shipSelection(opts: {
  format: ExportFormat;
  jpegQuality: number;
}): Promise<void> {
  const ids = useUiStore.getState().selectedLayerIds;
  if (ids.length === 0) {
    toast("Nothing to ship — select something first");
    return;
  }
  const layers = useDocStore.getState().layers;
  const selected = ids
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l && !l.hidden);
  const bbox = unionBounds(selected);
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
    toast("Selection has no visible bounds");
    return;
  }
  await shipExport({
    format: opts.format,
    jpegQuality: opts.jpegQuality,
    background: { kind: "color", color: 0x000000 },
    region: { x: bbox.left, y: bbox.top, width: bbox.width, height: bbox.height },
  });
}
